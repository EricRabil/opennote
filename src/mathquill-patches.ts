interface MathQuillAPI {
    LatexCmds: {
        integral: {
            prototype: {
                latex: Function;
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