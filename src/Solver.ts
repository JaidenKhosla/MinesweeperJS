import type GameEngine from "./GameEngine";
import { Cell } from "./GameEngine";
import Queue from "./Queue";

export default class Solver
{
    engine: GameEngine;
    mineMap: boolean[][];

    constructor(engine: GameEngine)
    {
        this.engine = engine;
        this.mineMap = Array.from({ length: this.engine.rows }, ()=> Array.from({length: this.engine.cols}, ()=>false));
    }

    
    getFlaggedCells(coords: [number, number]): number
    {
        return this.engine.getNeighboringCells(coords).filter(([x, y])=> this.mineMap[y][x]).length;
    }

    getUnrevealedCells(coords: [number, number]): number
    {
        return this.engine.getNeighboringCells(coords).filter(([x, y])=>(this.engine.board[y][x] & Cell.IS_REVEALED) == 0).length;
    }

    solveStep()
    {
        const queue = new Queue<[number, number]>();
        
        for(let cell = 0; cell < this.engine.rows * this.engine.cols; cell++)


    }

}