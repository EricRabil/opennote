declare module "algebrite" {
    namespace Algebrite {
        export interface Result {
            toString(): string;
        }
        export type Arg = string | Result;
        export function run(arg: Arg): string;
        export function factor(arg: Arg): Result;
        export function eval(arg: Arg): Result;
        export function integral(arg: Arg): Result;
        export function subst(a: string, b: string, c: Arg): Result;
        export function derivative(func: string, x: string | string[]): Result;
    }
    export = Algebrite;
}