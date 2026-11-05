
export function getNColors(n: number)
{
    return Array.from({ length: n }).map((_)=>[0,0,0].map(_=>Math.floor(Math.random() * 255)));
}