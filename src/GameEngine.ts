import Queue from "./Queue";

export enum Color
{
    LIGHT_CHECKER = "#AAD751",
    DARK_CHECKER = "#a2d149",
    REVEALED_LIGHT_CHECKER = "#E5C29F",
    REVEALED_DARK_CHECKER = "#d7b899",
    WON_LIGHT_CHECKER = "#8fc9f9",
    WON_DARK_CHECKER = "#84c4f7",
}

export enum Cell
{
    IS_MINE = 16,
    IS_REVEALED = 32,
    IS_FLAGGED = 64,
    MAXIMUM_MINES = 0b1111

}

export enum Status
{
    ONGOING,
    LOST,
    WON,
    UNSTARTED
}

const FONT_COLORS = [
    "",
    "#1976D2",
    "#388e3c",
    "#d32f2f",
    "#8333a2",
    "#f29000",
    "#0097a7",
    "#424242",
    "#a29383"
]

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

const DIFFICULTY_DIMENSIONS = {
    "EASY" : [10, 8, 10],
    "MEDIUM" : [18, 14, 40],
    "HARD" : [24, 20, 99]
}

export default class GameEngine
{
    rows: number;
    cols: number;
    maxMines: number;
    started: boolean = false;
    difficulty: Difficulty;

    mines: [number, number][];
    board: number[][]
    gameOver: boolean = false;
    won: boolean = false;
    prewin: boolean = false;

    flagsUsed: number = 0;
    timesStarted: number = 0;
    timeEnded: number = 0;

    static fromDifficulty(difficulty: Difficulty = "MEDIUM"): GameEngine
    {
        const [cols, rows, mines] = DIFFICULTY_DIMENSIONS[difficulty];

        return new GameEngine(difficulty, rows, cols, mines);
    }

    constructor(difficulty: Difficulty, rows: number, cols: number, maxMines = 99)
    {
        this.difficulty = difficulty;

        this.rows = rows;
        this.cols = cols;
        this.maxMines = maxMines;
        
        this.board = Array.from({length: this.rows}, ()=>Array.from({length: this.cols}, ()=>0));
        this.started = false;
        this.mines = [];
    }

    getStatus(): Status
    {
        if(!this.started) return Status.UNSTARTED;
        if(this.prewin) return Status.WON;
        if(this.gameOver) return Status.LOST;
        return Status.ONGOING;
    }

    generateMines([nX, nY]: [number, number])
    {

        if(this.gameOver) return;

        let mineCount = 0;

        const neighbors = this.getNeighboringCells([nX, nY]);

        while(mineCount < this.maxMines)
        {
            const rX = Math.floor(Math.random() * this.cols);
            const rY = Math.floor(Math.random() * this.rows);

            if(
                (rX == nX && rY == nY) ||
                (neighbors.filter(([tX, tY])=> tX == rX && tY == rY)).length != 0 ||
                (this.board[rY][rX] & Cell.IS_MINE) ||
                (this.board[rY][rX] & Cell.IS_REVEALED)
            ) continue;

            this.board[rY][rX] |= Cell.IS_MINE;
            mineCount++;

            this.mines.push([rX, rY]);
        }

        for(let r = 0; r< this.rows; r++)
        {
            for(let c = 0; c < this.cols; c++)
            {
                this.board[r][c] += this.preGetMines([c, r]);
            }
        }
    }

    public getMineLocations(): [number, number][]
    {
        return this.mines;
    }

    private preGetMines(coords: [number, number]): number
    {
        return this.getNeighboringCells(coords).filter(([x,y])=>this.board[y][x] & Cell.IS_MINE).length;
    }

    getMines([x, y]: [number, number]): number
    {
        return this.board[y][x] & Cell.MAXIMUM_MINES;
    }

    getFlags(coords: [number, number]): number
    {
        return this.getNeighboringCells(coords).filter(([x,y])=>this.board[y][x] & Cell.IS_FLAGGED).length;
    }

    getNeighboringCells([x, y]: [number, number]): number[][]
    {
        const neighbors = [];

        for(let dy = -1; dy <= 1; dy++)
        {
            for(let dx = -1; dx <= 1; dx++)
            {
                if(dy == 0 && dx == 0) continue;

                const newX = x+dx;
                const newY = y+dy;

                if(newX < 0 || newX >= this.cols || newY < 0 || newY >= this.rows) continue;
                
                neighbors.push([newX, newY]);
            }
        }



        return neighbors;
    }

    getBackgroundColor([x, y]: [number, number]): string
    {
        if(this.won && this.board[y][x] & Cell.IS_REVEALED)
        {
            return (y+x)%2 === 0 ? Color.WON_DARK_CHECKER : Color.WON_LIGHT_CHECKER;
        }
        else if(this.board[y][x] & Cell.IS_REVEALED)
        {
            return (y+x)%2 == 0 ? Color.REVEALED_DARK_CHECKER : Color.REVEALED_LIGHT_CHECKER;
        }
        else
        {
            return (y+x)%2 == 0 ? Color.DARK_CHECKER : Color.LIGHT_CHECKER;
        }
    }

    getFontColor(coords: [number, number]): string
    {
        return FONT_COLORS[this.getMines(coords)];
    }

    step([x, y]: [number, number]): Status
    {
        if(this.gameOver) return this.won ? Status.WON : Status.LOST;

        if(!this.started)
        {
            this.generateMines([x, y]);
            this.started = true;
            this.timesStarted = Date.now();
        }

        if(this.board[y][x] & Cell.IS_REVEALED || this.board[y][x] & Cell.IS_FLAGGED) return 0;
        
        if(this.board[y][x] & Cell.IS_MINE)
        {
            this.gameOver = true;
            this.timeEnded = Date.now();
            return Status.LOST;
        }

        // this.board[y][x] |= Cell.IS_REVEALED;

        this.flood_select([x, y]);

        if(this.hasWon())
        {
            this.timeEnded = Date.now();
            this.gameOver = true;

            this.prewin = true;

            Scoreboard.saveBestTime(this.difficulty, this.getTimeElapsed());

            return Status.WON;
        }
        return Status.ONGOING;
    }

    public toggleFlag([x, y]: [number, number])
    {
        // console.log("toggle");
        // console.log(`TOGGLE: ${JSON.stringify([x, y])}`);

        if(this.getStatus() === Status.UNSTARTED) return;

        if(this.board[y][x] & Cell.IS_REVEALED)
            return;

        this.board[y][x] ^= Cell.IS_FLAGGED;

        if(this.board[y][x] & Cell.IS_FLAGGED)
            this.flagsUsed++;
        else
            this.flagsUsed--;
    }

    public getNumberOfFlags(): number
    {
        return this.flagsUsed;
    }

    private flood_select(coords: [number, number])
    {
        const queue = new Queue<[number, number]>();

        queue.push(coords);

        while(queue.size > 0)
        {
            // console.log(queue);
            const [x, y] = queue.remove()! as [number, number];

            // console.log(`(${x}, ${y})`)

            if(this.board[y][x] & (Cell.IS_MINE | Cell.IS_REVEALED | Cell.IS_FLAGGED)) continue;
            
            this.board[y][x] |= Cell.IS_REVEALED;
            
            if(this.getMines([x,y]) === 0 && this.getFlags([x,y]) === 0)
                this.getNeighboringCells([x, y]).forEach(e=>queue.push(e as [number, number]));
            
        }
    }

    public getTimeElapsed(): number
    {
        return Number.parseFloat(((this.gameOver ? (this.timeEnded - this.timesStarted) : (Date.now() - this.timesStarted))/1000).toFixed(1));
    }

    public flagsLeft(): number
    {
        return this.maxMines - this.flagsUsed;
    }

    public isRevealed([c, r]: [number, number])
    {
        return (this.board[r][c] & Cell.IS_REVEALED) === Cell.IS_REVEALED;
    }
    
    public isFlagged([c, r]: [number, number])
    {
        return (this.board[r][c] & Cell.IS_FLAGGED) === Cell.IS_FLAGGED;
    }

    public hasWon(): boolean
    {
        if (this.flagsLeft() < 0) return false;

        let unrevealedCells = 0;

        for(let r = 0; r < this.rows; r++)
        {
            for(let c = 0; c < this.cols; c++)
            {
                const cell = this.board[r][c];

                const isRevealed = (cell & Cell.IS_REVEALED) !== 0;
                const isMine = (cell & Cell.IS_MINE) !== 0;
                const isFlagged = (cell & Cell.IS_FLAGGED) !== 0;

                // if(isMine && !isFlagged) unflaggedMines.push([c, r]);
                if(!isMine && isFlagged) return false;
                
                if(!isRevealed) unrevealedCells++;
            }
        }
        return this.maxMines === unrevealedCells;
    }

    public bfsCells(): [number, number][]
    {
        const cells: [number, number][] = [];

        const visited: boolean[][] = Array.from({length: this.rows}, ()=> new Array(this.cols).fill(false));

        const queue = new Queue<[number, number]>();
        queue.push([0,0]);

        while(queue.size != 0)
        {
            const [x, y] = queue.remove()!;

            cells.push([x, y]);

            visited[y][x] = true;

            const neighbors = this.getNeighboringCells([x, y]);

            for(const neighbor of neighbors)
            {
                if(!visited[neighbor[1]][neighbor[0]])
                {
                    queue.push(neighbor as [number, number]);
                    visited[neighbor[1]][neighbor[0]] = true;
                }
            }
        }

        return cells;
    }


    public teether([x, y]: [number, number], preview: boolean = false): [number, number][]
    {
    
        const neighbors = this.getNeighboringCells([x, y]).filter(([nx, ny])=>(this.board[ny][nx] & Cell.IS_REVEALED) === 0) as [number, number][];

        const unflaggedCells = neighbors.filter(([nx, ny])=>(this.board[ny][nx] & Cell.IS_FLAGGED) === 0);

        if(this.getStatus() === Status.UNSTARTED)
            return unflaggedCells;

        if((this.board[y][x] & Cell.IS_REVEALED)===0) return unflaggedCells;

        const flaggedCells = neighbors.length - unflaggedCells.length;

        if(!preview && flaggedCells === this.getMines([x, y]))
        {
            for(const cell of unflaggedCells)
            {
                const res = this.step(cell);
                if(res === Status.LOST) return [];
            }
        }
        
        return unflaggedCells;
        // return neighbors;
    }
}

export class Scoreboard
{
    static saveBestTime(difficulty: Difficulty, time: number): void
    {
        const bestTime = Math.min(time, Number.parseFloat(localStorage.getItem(difficulty) ?? time.toString()));
        localStorage.setItem(difficulty, bestTime.toString());
    }

    static getBestTime(difficulty: Difficulty): number | null
    {
        const unparsedTime = localStorage.getItem(difficulty);

        if (unparsedTime === null) return null;

        return Number.parseFloat(unparsedTime);
    }

}