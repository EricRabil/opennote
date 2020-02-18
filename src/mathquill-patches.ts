interface MathQuillAPI {
    LatexCmds: {
        integral: {
            prototype: {
                latex: Function;
            }
        },
        superscript: {
            prototype: {
                latex: Function;
            }
        },
        summation(): {
            __proto__: {
                latex: Function
            }
        }
    }
}

declare const MathQuillAPI: MathQuillAPI;

const { LatexCmds } = MathQuillAPI;
const { L, R } = MathQuill;

LatexCmds.integral.prototype.latex = function(this: any) {
    function simplify(latex: string) {
      return '{' + (latex || ' ') + '}';
    }
    return this.ctrlSeq + '_' + simplify(this.ends[L].latex()) +
      '^' + simplify(this.ends[R].latex());
}

LatexCmds.superscript.prototype.latex = function(this: any) {
    function latex(prefix: string, block: {latex(): string}) {
        var l = block && block.latex();
        return block ? prefix + '{' + (l || ' ') + '}' : '';
    }
    return latex('_', this.sub) + latex('^', this.sup);
}

LatexCmds.summation().__proto__.latex = function(this: any) {
    function simplify(latex: string) {
        return '{' + (latex || ' ') + '}';
    }
    return this.ctrlSeq + '_' + simplify(this.ends[L].latex()) +
    '^' + simplify(this.ends[R].latex());
}