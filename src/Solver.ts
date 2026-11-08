import type GameEngine from "./GameEngine";
import { Cell } from "./GameEngine";
import type { GUI } from "./main";

type Constraint = {
    remaining: number,
    unrevealed: Set<number>
}
export default class Solver
{
    engine: GameEngine;
    mineMap: boolean[][];

    constructor(engine: GameEngine)
    {
        this.engine = engine;
        this.mineMap = Array.from({ length: this.engine.rows }, ()=> Array.from({length: this.engine.cols}, ()=>false));
    }

    
    getFlaggedCells(coords: [number, number])
    {
        return this.engine.getNeighboringCells(coords).filter(([x, y])=> this.engine.isFlagged([x, y]))
    }

    getUnrevealedCells(coords: [number, number])
    {
        return this.engine.getNeighboringCells(coords).filter(([x, y])=>!this.engine.isRevealed([x, y])&&!this.engine.isFlagged([x, y]));
    }

  

    solveStep(gui: GUI) //stepCallback: (coords: [number, number])=>any, flagCallback: (coords: [number, number])=>void
    {
        // console.log(`INNER ENGINE: ${JSON.stringify(this.engine)}`);
        const compress = ([x, y]: [number, number]) => y*gui.engine.cols + x;
        const expand = (n: number) => [n%gui.engine.cols, Math.floor(n/gui.engine.cols)];
        
        const constraints: Constraint[] = [];

        let changed = false;

        do
        {
            changed = false;
            for(let cell = 0; cell < this.engine.rows * this.engine.cols; cell++)
            {
                const r = Math.floor(cell/this.engine.cols);
                const c = cell%this.engine.cols;
    
                if((this.engine.board[r][c] & Cell.IS_REVEALED) == 0) continue;
                
                const mineNumber = this.engine.getMines([c, r]);
    
                const knownMines = this.getFlaggedCells([c, r]) as [number, number][];
                
                const potentialMines = this.getUnrevealedCells([c, r]) as [number, number][];
    
                const minesLeft = mineNumber-knownMines.length;
    
                // console.log(`[${c}, ${r}] : PotentialMines = ${JSON.stringify(potentialMines)} minesLeft = ${minesLeft} knownMines=${JSON.stringify(knownMines)}`);
                if(potentialMines.length === 0) continue;

                if(minesLeft === potentialMines.length)
                {
                    // console.log("FLAG ALL");
                    potentialMines.forEach(coords=> gui.engine.toggleFlag(coords));
                    changed = true;
                }
                else if(minesLeft === 0)
                {
                    potentialMines.forEach(coords=> gui.step(coords));
                    changed = true;
                }
            }
        } while(changed);


        for(let cell = 0; cell < this.engine.rows * this.engine.cols; cell++)
        {
            const r = Math.floor(cell/this.engine.cols);
            const c = cell%this.engine.cols;

            if((this.engine.board[r][c] & Cell.IS_REVEALED) == 0) continue;
            
            const mineNumber = this.engine.getMines([c, r]);

            const knownMines = this.getFlaggedCells([c, r]) as [number, number][];
            
            const potentialMines = this.getUnrevealedCells([c, r]) as [number, number][];

            const minesLeft = mineNumber-knownMines.length;

            if(minesLeft !== 0) constraints.push({ remaining: minesLeft, unrevealed: new Set<number>(potentialMines.map(compress))});
        }
        
        const stringify = (a: any) => {
            return JSON.stringify(a, (_key, value) => (value instanceof Set ? [...value] : value));
        }

        console.log(stringify(constraints));

        for(let i = 0; i < constraints.length; i++)
        {
            for(let j = 0; j < constraints.length; j++)
            {
                if(i === j) continue;

                const constraintB = constraints[i];
                const constraintA = constraints[j];

                console.log(`A(${i}): ${stringify(constraintA)} B(${j}): ${stringify(constraintB)}`);

                if([...constraintB.unrevealed].every(k=>constraintA.unrevealed.has(k)))
                {
                    console.log("A SUBSET B");
    
                    const minesLeft = constraintA.remaining - constraintB.remaining;
                    const uncheckedMines = [...constraintA.unrevealed].filter(k=>!constraintB.unrevealed.has(k)).map(expand) as [number, number][];
    
                    console.log(`MINES LEFT: ${minesLeft} uncheckedMines: ${JSON.stringify(uncheckedMines)}`);
    
                    if(minesLeft === 0) uncheckedMines.forEach(coords=> gui.step(coords));
                    else if(minesLeft === uncheckedMines.length) uncheckedMines.forEach(coords=> gui.engine.toggleFlag(coords)); 
                }
                else if([...constraintB.unrevealed].some(k=>constraintA.unrevealed.has(k)))
                {

                }

            }
        }

    }

}