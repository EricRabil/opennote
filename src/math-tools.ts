import Algebrite from "algebrite";
import utensils from "latex-utensils";
import { TextString, Group, Node } from 'latex-utensils/out/src/latex/latex_parser';
import * as math from 'mathjs';

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
    return node.kind === "arg.group";
}

function isTextString(node: Node): node is TextString {
    return node.kind === "text.string";
}

function collapseGroup(group: Group, context: any): TextString {
    if (isTextString(group)) return group;
    if (!isGroup(group)) throw new Error("illegal arg passed to collapser: " + (group as any).kind);
    return {
        kind: "text.string",
        content: condenseSiblings(group.content, context).filter(sib => sib.kind === 'text.string').map(sib => (sib as TextString).content).join(''),
        location: fakeLocation
    }
}

function condenseSiblings(siblings: utensils.latexParser.Node[], context: any): utensils.latexParser.Node[] {
    // console.debug(`condensing siblings`, siblings);
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
                siblings[i] = {
                    kind: "text.string",
                    content: command(item.args, siblings, i, context),
                    ['wasCommand' as any]: true,
                    location: fakeLocation
                };
                break;
            case 'text.string':
                if (!prev) continue;
                if (prev.kind === 'arg.group') {
                    if (item.content === ')') continue;
                    /**
                     * Adds implicit multiplication for things immediately following paren
                     */
                    siblings.splice(i, 0, text('*'));
                } else if (prev.kind === 'command' || (prev as any).wasCommand) {
                    if (item.content.startsWith('(')) continue;
                    /**
                     * Adds implicit parenthesis for single-argument function calls
                     */
                    const { content: flat } = collapseGroup(group(siblings.slice(i, i + 3)), context);
                    const functions = functionsFromContext(context);
                    const isFunc = !!functions[flat];
                    if (isFunc) {
                        // if this is a contextual function call, just replace the contents with the value of the function :3
                        siblings.splice(i, 3, text(`(${flat})`));
                    } else {
                        siblings.splice(i, 0, text('('));
                        siblings.splice(i + 2, 0, text(')'));
                    }
                }
                break;
            default:
                continue;
        }
    }

    // collapse groups into text strings after parsing
    siblings = siblings.map(sib => {
        if (sib.kind === 'arg.group') {
            return collapseGroup(sib, context);
        }
        return sib;
    });
    
    return siblings;
}

export function astToExpressionTree(siblings: utensils.latexParser.Node[], context: any): string {
    siblings = siblings.filter(sib => sib.kind === 'command' ? (sib.name !== 'left' && sib.name !== 'right') : true);
    siblings = condenseSiblings(siblings, context);
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
function replaceFunctionReferencesWithLiterals(str: string, context: any) {
    const functions = functionsFromContext(context);
    Object.keys(functions).forEach(fn => {
        while(str.includes(fn)) {
            console.log(fn);
            str = fn.replace(fn, functions[fn]);
        }
    });
    return str;
}

/**
 * Returns a map of function signatures to their expression
 * @param context math context
 */
function functionsFromContext(context: any): {[key: string]: string} {
    return Object.values(context).filter(g => typeof g === 'function').reduce((acc: any, c: any) => {acc[c.syntax] = c.original.substring(c.syntax.length + 1); return acc;},{}) as any;
}

function flattenContentForEvaluation(content: Node[], context: string) {
    return replaceFunctionReferencesWithLiterals(astToExpressionTree(content, context), context);
}

/**
 * Determines if a fraction is a derivative directive, returning the variable to derive using if so
 * @param numerator frac numerator
 * @param denominator frac denominator
 */
function shouldDerive(numerator: string, denominator: string): { respectTo: string } | false {
    if (numerator === 'd' && denominator.startsWith('d') && denominator.length > 1) return { respectTo: denominator.substring(1) }
    return false;
}

class Commands {
    @command('divide')
    static frac([numerator, denominator]: Content[], siblings: utensils.latexParser.Node[], index: number, context: any) {
        const {content: num} = collapseGroup(numerator as any, context);
        const {content: denom} = collapseGroup(denominator as any, context);
        const derive = shouldDerive(num, denom);
        if (derive) {
            const expression = replaceFunctionReferencesWithLiterals(collapseGroup(group(siblings.slice(index + 1)), context).content, context);
            const derived = Algebrite.derivative(expression, derive.respectTo).toString();
            siblings.splice(index, siblings.length - 1);
            siblings[index] = text(derived);
            return derived;
        }
        return `((${collapseGroup(numerator as any, context).content})/(${collapseGroup(denominator as any, context).content}))`;
    }

    @command()
    static cdot() {
        return `*`;
    }

    @command()
    static int(args: Content[], siblings: utensils.latexParser.Node[], index: number, context: any) {
        let [,,subscript,,superscript,...content] = siblings.slice(index);
        subscript = collapseGroup(subscript as Group, context);
        superscript = collapseGroup(superscript as Group, context);
        let strContent = flattenContentForEvaluation(content, context);
        const definite = subscript.content.length > 0 && superscript.content.length > 0;

        let result = Algebrite.integral(strContent).toString();
        const subst = (value: string) => Algebrite.subst(`(${value})`, 'x', result);

        if (definite) {
            // calculate it! fuck
            result = `((${subst(superscript.content)}) - (${subst(subscript.content)}))`;
        }
        
        siblings.splice(index, siblings.length - 1);

        return result;
    }

    @command()
    static sqrt(args: Content[]) {
        return `sqrt(${args.join()})`
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
    static sum(_: Content[], siblings: utensils.latexParser.Node[], index: number, context: any) {
        const [,,start,,stop,...content] = siblings.slice(index) as Group[];
        const {content: startStr} = collapseGroup(start, context);
        const {content: stopIdx} = collapseGroup(stop, context);
        const contentStr = flattenContentForEvaluation(content, context);
        const [variable, startIdx] = startStr.split('=');

        const result = Algebrite.sum(contentStr, variable, startIdx, stopIdx).toString();

        console.debug(`glenoxi, we sum`, {
            start,
            stop,
            content,
            startStr,
            stopIdx,
            contentStr,
            variable,
            startIdx,
            result
        });

        siblings.splice(index, siblings.length - 1);

        return result;
    }

    @command()
    static log(args: Content[]) {
        return `log`;
    }
}