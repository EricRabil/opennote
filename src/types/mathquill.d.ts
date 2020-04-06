declare interface MathParser {
    skip(parser: MathParser): this;
    or(parser: MathParser): this;
    result(arg1: any): this;
    parse(latex: string): any;
    all: MathParser;
    eof: MathParser;
}
declare const latexMathParser: MathParser;

declare namespace MathQuill {
    export function getInterface(version: number): typeof MathQuill;

    interface Config {
        spacesBehavesLikeTab?: boolean;
        leftRightIntoCmdGoes?: string;
        restrictMismatchedBrackets?: boolean;
        sumStartsWithNEquals?: boolean;
        supSubsRequireOperand?: boolean;
        charsThatBreakOutOfSupSub?: string;
        autoSubscriptNumerals?: boolean;
        autoCommands?: string;
        autoOperatorNames?: string;
        maxDepth?: number;
        substituteTextarea?: () => HTMLElement;
        overrideKeystroke?: (key: any, e: KeyboardEvent) => any;
        handlers?: {
            edit?: (mathField: MathField) => any;
            upOutOf?: (mathField: MathField) => any;
            downOutOf?: (mathField: MathField) => any;
            enterOutOf?: (mathField: MathField) => any;
            leftOutOf?: (mathField: MathField) => any;
            rightOutOf?: (mathField: MathField) => any;
            moveOutOf?: (dir: string, mathField: MathField) => any;
            deleteOutOf?: (dir: string, mathField: MathField) => any;
            reflow?: () => any;
            enter?: (mathField: MathField) => any;
        }
    }

    export class StaticMath {
        constructor(element: Element);

        revert(): HTMLElement;
        reflow(): void;
        el(): HTMLElement;
        latex(): string;
        latex(latex: string): void;
    }

    export class MathField extends StaticMath {
        constructor(element: Element, config: Config);

        focus(): void;
        blur(): void;
        write(latex: string): void;
        cmd(latex: string): void;
        select(): void;
        clearSelection(): void;
        moveToLeftEnd(): void;
        moveToRightEnd(): void;
        moveToDirEnd(direction: string): void;
        keystroke(keys: string): void;
        typedText(text: string): void;
        config(newConfig: Config): void;
        dropEmbedded(x: number, y: number, options?: {
            htmlString?: string;
            text?: () => string;
            latex?: () => string;
        }): void;
    }

    export const R: number;
    export const L: number;
}

declare interface Window {
    MathQuill: typeof MathQuill;
}