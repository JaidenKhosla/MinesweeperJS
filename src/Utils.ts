
//Generates a pseudorandom number given a seed. Credits to bryc on StackOverflow
export function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

export function getNSeededColors(seed: number, n: number)
{
    const rand = mulberry32(seed);

    return Array.from({ length: n }).map((_)=>[0,0,0].map(_=>Math.floor(rand() * 255)));
}