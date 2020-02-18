import utensils from "latex-utensils";
import { TextString, Group, Node } from 'latex-utensils/out/src/latex/latex_parser';

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

function isGroup(node: Node): node is Group {
    return node.kind === "arg.group";
}

function isTextString(node: Node): node is TextString {
    return node.kind === "text.string";
}

function collapseGroup(group: Group): TextString {
    if (isTextString(group)) return group;
    if (!isGroup(group)) throw new Error("illegal arg passed to collapser");
    return {
        kind: "text.string",
        content: condenseSiblings(group.content).filter(sib => sib.kind === 'text.string').map(sib => (sib as TextString).content).join(''),
        location: fakeLocation
    }
}

function condenseSiblings(siblings: utensils.latexParser.Node[]): utensils.latexParser.Node[] {
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
                next.content.unshift({
                    kind: "text.string",
                    content: "^",
                    location: fakeLocation
                }, {
                    kind: "text.string",
                    content: "(",
                    location: fakeLocation
                });
                next.content.push({
                    kind: "text.string",
                    content: ")",
                    location: fakeLocation
                });
                siblings.splice(i, 1);
                break;
            case 'command':
                let command: (args: any[], siblings: utensils.latexParser.Node[], index: number) => string = (Commands as any)[item.name];
                if (!command) {
                    console.debug(`unknown command`, item);
                    siblings.splice(i, 1);
                    continue;
                }
                console.log(command);
                /**
                 * Flatten command call to a string
                 */
                siblings[i] = {
                    kind: "text.string",
                    content: command(item.args, siblings, i),
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
                    siblings.splice(i, 0, {
                        kind: "text.string",
                        content: "*",
                        location: fakeLocation
                    });
                } else if (prev.kind === 'command' || (prev as any).wasCommand) {
                    if (item.content.startsWith('(')) continue;
                    /**
                     * Adds implicit parenthesis for single-argument function calls
                     */
                    siblings.splice(i, 0, {
                        kind: "text.string",
                        content: "(",
                        location: fakeLocation
                    });
                    siblings.splice(i + 2, 0, {
                        kind: "text.string",
                        content: ")",
                        location: fakeLocation
                    });
                }
                break;
            default:
                continue;
        }
    }

    // collapse groups into text strings after parsing
    siblings = siblings.map(sib => {
        if (sib.kind === 'arg.group') {
            return collapseGroup(sib);
        }
        return sib;
    });
    
    return siblings;
}

export function astToExpressionTree(siblings: utensils.latexParser.Node[], condensed: boolean = false): string {
    siblings = siblings.filter(sib => sib.kind === 'command' ? (sib.name !== 'left' && sib.name !== 'right') : true);
    if (!condensed) siblings = condenseSiblings(siblings);
    return siblings.filter(sib => sib.kind === 'text.string').map(sib => (sib as TextString).content).join('');
}

type Content = utensils.latexParser.Node[];

function command(...aliases: string[]): any {
    return (fn: Function) => {
        aliases.forEach(a => (Commands as any)[a] = fn);
    }
}

class Commands {
    @command('divide')
    static frac([numerator, denominator]: Content[]) {
        return `((${collapseGroup(numerator as any).content})/(${collapseGroup(denominator as any).content}))`;
    }

    @command()
    static cdot() {
        return `*`;
    }

    @command()
    static int(args: Content[], siblings: utensils.latexParser.Node[], index: number) {
        let [,,subscript,,superscript,content] = siblings.slice(index);
        subscript = collapseGroup(subscript as Group);
        superscript = collapseGroup(superscript as Group);
        content = collapseGroup(content as Group);
        const definite = subscript.content.length === 0 || superscript.content.length === 0;
        
        let result = `integral("${content.content}", "x")`;
        
        siblings.splice(index, 6);
        siblings[index] = text(result);
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
    static log(args: Content[]) {
        return `log`;
    }
}