
import utensils from "latex-utensils";
import nerdamer from 'nerdamer';
require('nerdamer/Calculus.js');
import { TextString, Group, Node } from 'latex-utensils/out/src/latex/latex_parser';

globalThis.window = globalThis.window || globalThis as any;

const fakePos = {
    column: NaN,
    line: NaN,
    offset: NaN
}

const fakeLocation = {
    start: fakePos,
    end: fakePos
}

function text(content: string): TextString {
    return {
        kind: "text.string",
        content,
        location: fakeLocation
    }
}

function group(nodes: Node[]): Group {
    return {
        kind: "arg.group",
        content: nodes,
        location: fakeLocation
    }
}

function isGroup(node: Node): node is Group {
    if (!node) return false;
    return node.kind === "arg.group";
}

function isTextString(node: Node): node is TextString {
    if (!node) return false;
    return node.kind === "text.string";
}

async function collapseGroup(group: Group, context: any): Promise<TextString> {
    if (isTextString(group)) return group;
    if (!isGroup(group)) throw new Error("illegal arg passed to collapser: " + (group as any).kind);
    return {
        kind: "text.string",
        content: (await condenseSiblings(group.content, context)).filter(sib => sib.kind === 'text.string').map(sib => (sib as TextString).content).join(''),
        location: fakeLocation
    }
}

async function condenseSiblings(siblings: utensils.latexParser.Node[], context: any): Promise<utensils.latexParser.Node[]> {
    for (let i = 0; i < siblings.length; i++) {
        let item = siblings[i];
        let prev = siblings[i - 1];
        let next = siblings[i + 1];
        switch (item.kind) {
            case 'superscript':
                if (next.kind !== 'arg.group') continue;
                /**
                 * Flatten superscript block into a text group
                 */
                const firstChar = next.content[0];
                if (isTextString(firstChar) && firstChar.content === '^') continue;
                next.content.unshift(text('^'), text('('));
                next.content.push(text(')'));
                siblings.splice(i, 1);
                break;
            case 'command':
                let command: (args: any[], siblings: utensils.latexParser.Node[], index: number, context: any) => string = (Commands as any)[item.name];
                if (!command) {
                    console.debug(`unknown command`, item);
                    siblings.splice(i, 1);
                    continue;
                }
                /**
                 * Flatten command call to a string
                 */
                try {
                    siblings[i] = {
                        kind: "text.string",
                        content: await command(item.args, siblings, i, context),
                        ['wasCommand' as any]: true,
                        location: fakeLocation
                    };
                } catch (e) {
                    console.debug('failed to execute command!', e);
                    siblings[i] = text('error');
                }
                break;
            case 'text.string':
                if (!prev) continue;
                if (prev.kind === 'arg.group') {
                    if (item.content === ')') continue;
                    /**
                     * Adds implicit multiplication for things immediately following paren
                     */
                } else if (prev.kind === 'command' || (prev as any).wasCommand) {
                    if (item.content.startsWith('(')) continue;
                    /**
                     * Adds implicit parenthesis for single-argument function calls
                     */
                    const { content: flat } = await collapseGroup(group(siblings.slice(i, i + 3)), context);
                    const isFunc = !!context[flat];
                    if (isFunc) {
                        // if this is a contextual function call, just replace the contents with the value of the function :3
                        siblings.splice(i, 3, text(`(${flat})`));
                    }
                }
                break;
            default:
                continue;
        }
    }

    // collapse groups into text strings after parsing
    siblings = await Promise.all(siblings.map(sib => {
        if (sib.kind === 'arg.group') {
            return collapseGroup(sib, context);
        }
        return sib;
    }) as any);
    
    return siblings;
}

export async function astToExpressionTree(siblings: utensils.latexParser.Node[], context: any): Promise<string> {
    siblings = siblings.filter(sib => sib.kind === 'command' ? (sib.name !== 'left' && sib.name !== 'right') : true);
    siblings = await condenseSiblings(siblings, context);
    return siblings.filter(sib => sib.kind === 'text.string').map(sib => (sib as TextString).content).join('');
}

type Content = utensils.latexParser.Node[];

function command(...aliases: string[]): any {
    return (fn: Function) => {
        aliases.forEach(a => (Commands as any)[a] = fn);
    }
}

/**
 * Replaces references to functions with their literal values
 * @param str math expression
 * @param context math context
 */
function replaceFunctionReferencesWithLiterals(str: string, functions: any) {
    Object.keys(functions).forEach(fn => {
        while(str.includes(fn)) {
            str = fn.replace(fn, functions[fn]);
        }
    });
    return str;
}

async function flattenContentForEvaluation(content: Node[], context: string) {
    return replaceFunctionReferencesWithLiterals(await astToExpressionTree(content, context), context);
}

/**
 * Determines if a fraction is a derivative directive, returning the variable to derive using if so
 * @param numerator frac numerator
 * @param denominator frac denominator
 */
function shouldDerive(numerator: string, denominator: string): { respectTo: string, count: number } | false {
    if (numerator.startsWith('d') && denominator.startsWith('d') && denominator.length > 1) {
        let count: number = 1;
        let countDirective = numerator.substring(1);
        if (!(count = parseInt(countDirective))) {
            const isShorthand = countDirective.split('').every(d => d === '\'');
            if (isShorthand) count = countDirective.length;
        }
        return { respectTo: denominator.substring(1), count: count || 1 }
    }
    return false;
}

class Commands {
    @command('divide')
    static async frac([numerator, denominator]: Content[], siblings: utensils.latexParser.Node[], index: number, context: any) {
        const {content: num} = await collapseGroup(numerator as any, context);
        const {content: denom} = await collapseGroup(denominator as any, context);
        const derive = shouldDerive(num, denom);
        if (derive) {
            const expression = replaceFunctionReferencesWithLiterals((await collapseGroup(group(siblings.slice(index + 1)), context)).content, context);
            // const derived = Algebrite.derivative(expression, derive.respectTo).toString();
            const derived = (nerdamer as any).diff(expression, derive.respectTo, derive.count).text();
            siblings.splice(index, siblings.length - 1);
            siblings[index] = text(derived);
            return derived;
        }
        return `((${(await collapseGroup(numerator as any, context)).content})/(${(await collapseGroup(denominator as any, context)).content}))`;
    }

    @command()
    static cdot() {
        return `*`;
    }

    @command()
    static async int(args: Content[], siblings: utensils.latexParser.Node[], index: number, context: any) {
        let [,,subscript,,superscript,...content] = siblings.slice(index);
        subscript = await collapseGroup(subscript as Group, context);
        superscript = await collapseGroup(superscript as Group, context);
        let strContent = await flattenContentForEvaluation(content, context);
        const definite = subscript.content.length > 0 && superscript.content.length > 0;

        if (strContent.endsWith('dx')) strContent = strContent.substring(0, strContent.length - 2);

        const { __var__: variables } =  context;

        strContent = nerdamer(strContent, variables).toString();

        let result;
        if (definite) {
            result = (nerdamer as any).defint(strContent, subscript.content, superscript.content).text()
        } else {
            result = (nerdamer as any).integrate(strContent).text();
            context.__flags__.noVarSubInPostProcessing = true;
        }
        
        siblings.splice(index, siblings.length - 1);

        return result;
    }

    @command()
    static async sqrt(args: Content[], siblings: utensils.latexParser.Node[], index: number, context: any) {
        return `sqrt(${await astToExpressionTree(args as any, context)})`;
    }

    @command()
    static sin(args: Content[]) {
        return `sin`
    }

    @command()
    static cos(args: Content[]) {
        return `cos`
    }

    @command()
    static tan(args: Content[]) {
        return `tan`;
    }

    @command()
    static pi(args: Content[]) {
        return `pi`;
    }

    @command()
    static ln(args: Content[], siblings: utensils.latexParser.Node[], index: number, context: any) {
        return `log`;
    }

    @command()
    static sec() {
        return `sec`;
    }

    @command()
    static csc() {
        return `csc`;
    }

    @command()
    static cot() {
        return `cot`;
    }

    @command()
    static async sum(_: Content[], siblings: utensils.latexParser.Node[], index: number, context: any) {
        const [,,start,,stop,...content] = siblings.slice(index) as Group[];
        const {content: startStr} = await collapseGroup(start, context);
        const {content: stopIdx} = await collapseGroup(stop, context);
        const contentStr = await flattenContentForEvaluation(content, context);
        const [variable, startIdx] = startStr.split('=');

        // const result = Algebrite.sum(contentStr, variable, startIdx, stopIdx).toString();
        const result = (nerdamer).sum(contentStr, variable, startIdx, stopIdx);

        siblings.splice(index, siblings.length - 1);

        return result;
    }

    @command()
    static log(args: Content[]) {
        return `log`;
    }
}

onmessage = async function(event: MessageEvent) {
    const { evaluate, functions, variables, nonce } = event.data;
    const flags = {};
    postMessage({
        nonce,
        result: await astToExpressionTree(evaluate, Object.assign({}, functions, { __var__: variables, __flags__: flags })),
        flags
    }, undefined as any);
}