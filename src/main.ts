import './style.css'
import GameEngine, { Scoreboard, Color, Cell, Status } from './GameEngine';
import type { Difficulty } from './GameEngine';

import { getNColors } from './Utils';
import Solver from './Solver';

const loadImage = (image_path: string) => {
    const img = new Image();
    img.src = image_path;
    return img;
}

const FLAG_IMAGE_ASSET = loadImage("./assets/flag.png");
const X_IMAGE_ASSET = loadImage("./assets/x.png");

const MINE_BODY_ASSET = loadImage("./assets/mineBody.png");
const MINE_OVERLAY_ASSET = loadImage("./assets/mineOverlay.png");


export class GUI
{
    board: HTMLCanvasElement = document.getElementById("board")! as HTMLCanvasElement;
    overlay: HTMLCanvasElement = document.getElementById("overlay")! as HTMLCanvasElement;

    ctx: CanvasRenderingContext2D = this.board.getContext("2d")!;
    overlayCtx: CanvasRenderingContext2D = this.overlay.getContext("2d")!;

    mineCounterLabel: HTMLParagraphElement = document.getElementById("mineCount")! as HTMLParagraphElement;
    timerLabel: HTMLParagraphElement = document.getElementById("timer")! as HTMLParagraphElement;

    scoreboard: HTMLDivElement = document.getElementById("scoreboard")! as HTMLDivElement;
    currentTimeScoreboardLabel: HTMLParagraphElement = document.getElementById("currentTime")! as HTMLParagraphElement;
    bestTimeScoreboardLabel: HTMLParagraphElement = document.getElementById("bestTime")! as HTMLParagraphElement;

    engine: GameEngine;
    
    cellSize: number;
    labelEvent: number = -1;
    abortController: AbortController;


    mineColors: number[][];

    animationPlaying: boolean = false;
    animationID: number = -1;

    constructor(difficulty?: Difficulty)
    {
        this.abortController = new AbortController();

        const boundingBox = this.board.getBoundingClientRect();
        
        this.board.width = boundingBox.width;
        this.board.height = boundingBox.height;
        
        this.overlay.width = boundingBox.width;
        this.overlay.height = boundingBox.height;
        
        this.engine = GameEngine.fromDifficulty(difficulty);
        // this.cellSize = Math.floor(Math.min(boundingBox.width/this.engine.cols, boundingBox.height/this.engine.rows));
        this.cellSize = (boundingBox.width/this.engine.cols);
        this.ctx.font = `bold ${this.board.width/boundingBox.width*10}px sans-serif`;

        this.mineColors = getNColors(this.engine.cols * this.engine.rows);

        window.addEventListener("resize", ()=>{
            
            const boundingBox = this.board.getBoundingClientRect();
            
            this.board.width = boundingBox.width;
            this.board.height = boundingBox.height;

            this.overlay.width = boundingBox.width;
            this.overlay.height = boundingBox.height;

            this.cellSize = (boundingBox.width/this.engine.cols);

            this.erase(false);
            this.draw();
        
            if(this.engine.gameOver)
                this.showScoreboard();

        }, { signal: this.abortController.signal})

        this.overlay.addEventListener("mousemove", (e) =>
        {
            if(this.engine.gameOver) return
            
            const rect = this.board.getBoundingClientRect();

            const c = Math.floor((e.clientX - rect.left)/this.cellSize);
            const r = Math.floor((e.clientY - rect.top)/this.cellSize);

            const overlayCtx = this.overlay.getContext("2d")!;

            overlayCtx.clearRect(0, 0, this.overlay.width, this.overlay.height);

            overlayCtx.fillStyle = "rgba(255, 255, 255, 0.3)";
            overlayCtx.fillRect(c * this.cellSize, r * this.cellSize, this.cellSize, this.cellSize);

            if(e.buttons & 4)
            {
                this.teetherClick(e, true);
            }

        }, { signal: this.abortController.signal});

        this.overlay.addEventListener("mouseleave", ()=> {
            
            if(this.engine.gameOver) return;
            
            const overlayCtx = this.overlay.getContext("2d")!;
            overlayCtx.clearRect(0, 0, this.overlay.width, this.overlay.height);
        }, { signal: this.abortController.signal});

        this.overlay.addEventListener("click", (e) => {

            if(this.engine.gameOver || e.button === 1)
            {
                if(this.animationPlaying)
                {
                    this.animationPlaying = false;
                    this.showScoreboard();
                }
                return;
            }

            const rect = this.board.getBoundingClientRect();

            const c = Math.floor((e.clientX - rect.left)/this.cellSize);
            const r = Math.floor((e.clientY - rect.top)/this.cellSize);

            this.step([c, r]);

        }, { signal: this.abortController.signal});


        this.overlay.addEventListener("dblclick", (e)=>this.teetherClick(e), { signal: this.abortController.signal});
        this.overlay.addEventListener("mousedown", (e)=>{

            if(e.button === 1)
            {       
                e.preventDefault();
                this.teetherClick(e);
            }
        }, { signal: this.abortController.signal});


        this.overlay.addEventListener("contextmenu", (e) => {

            
            e.preventDefault();
            if(this.engine.gameOver) return;

            const rect = this.board.getBoundingClientRect();
            
            const c = Math.floor((e.clientX - rect.left)/this.cellSize);
            const r = Math.floor((e.clientY - rect.top)/this.cellSize);

            this.engine.toggleFlag([c, r]);

            this.erase(false);
            this.draw();

            this.updateLabels(0);
        }, { signal: this.abortController.signal});
        
        this.updateLabels(0);
        this.timerLabel.innerText = "0";
    }


    step([c, r]: [number, number], teether: boolean = false)
    {

        const res = teether ? this.engine.getStatus() : this.engine.step([c, r]);
        if (this.labelEvent === -1 && this.engine.getStatus() !== Status.UNSTARTED)
        {
            this.labelEvent = setInterval(()=>this.updateLabels(1), 10);
        }
        
        if(res === Status.LOST)
            this.blowup([c, r]);
        else if(res === Status.WON || res === Status.ONGOING)
        {
            this.erase(res === Status.WON);
            this.draw();

            if(res === Status.WON)
            {
                this.win();
            }
        }
    }
    
    erase(eraseOverlay: boolean = true): void
    {
        this.ctx.clearRect(0, 0, this.board.width, this.board.height);
        
        if(eraseOverlay)
        {
            // const overlayCtx = this.overlay.getContext("2d")!;
            this.overlayCtx.clearRect(0, 0, this.overlay.width, this.overlay.height);
        }
    }

    public cleanUp(): void
    {
        this.erase();
        this.overlay.getContext("2d")!.clearRect(0,0, this.overlay.width, this.overlay.height);

        this.abortController.abort();
        clearInterval(this.labelEvent);

        this.overlay.classList.remove("darken");

        this.scoreboard.classList.remove("shown");
        this.scoreboard.classList.add("hidden");
    }

    private distanceTo([x1, y1]: number[], [x2, y2]: number[]): number
    {
        return Math.sqrt(Math.pow((x2-x1),2) + Math.pow((y2-y1), 2));
    }

    async blowup(first: number[])
    {
        const minesAndFlags = this.engine.bfsCells().filter(([x, y])=> (this.engine.board[y][x] & (Cell.IS_FLAGGED | Cell.IS_MINE)) !== 0);

        minesAndFlags.sort((a, b) => this.distanceTo(first, a)-this.distanceTo(first, b));

        let i = 0;

        this.animationPlaying = true;
        
        const interval = setInterval(()=>{
            if(i >= minesAndFlags.length || !this.animationPlaying)
            {
                clearInterval(interval);

                if(this.animationPlaying)
                    this.showScoreboard();

                this.animationPlaying = false;
                return;
            }

            const [mX, mY] = minesAndFlags[i++];

            
            this.engine.board[mY][mX] |= Cell.IS_REVEALED;
            this.ctx.fillStyle = this.engine.getBackgroundColor([mX, mY]);
            this.ctx.fillRect(mX * this.cellSize, mY * this.cellSize, this.cellSize, this.cellSize);

            this.drawMine([mX, mY]);
        }, 30
    );
    }

    private drawMine([x, y]: [number, number])
    {
        if((this.engine.board[y][x] & Cell.IS_MINE) === 0)
            this.ctx.drawImage(X_IMAGE_ASSET, x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
        else
        {

            this.overlayCtx.clearRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
            this.overlayCtx.drawImage(MINE_BODY_ASSET, x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
            
            const imageData = this.overlayCtx.getImageData(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
            const { data : dataBuffer } = imageData;

            const COLOR = this.mineColors[y*this.engine.rows + x];

            for(let i = 0; i < dataBuffer.length; i+=4)
            {
                
                if(Math.abs(dataBuffer[i+3]-255) > 50)
                {
                    dataBuffer[i+3] = 0;
                    continue;
                }
                
                dataBuffer[i] = COLOR[0];
                dataBuffer[i+1] = COLOR[1];
                dataBuffer[i+2] = COLOR[2];
            }

            this.overlayCtx.putImageData(imageData, x * this.cellSize, y * this.cellSize);

            this.overlayCtx.drawImage(MINE_OVERLAY_ASSET, x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
        }
    }

    async win()
    {
        const magnitude = ([x,y]: [number, number]) => Math.sqrt(x*x + y*y);
        const cells = this.engine.bfsCells().filter(([x,y])=> (this.engine.board[y][x] & Cell.IS_MINE) === 0).sort((a,b)=> magnitude(a) - magnitude(b));
        
        let i = 0;

        this.animationPlaying = true;
        const interval = setInterval(() => {
            if(i >= cells.length || !this.animationPlaying)
            {
                clearInterval(interval);
                this.engine.won = true;

                if(this.animationPlaying)
                    this.showScoreboard();
                
                this.animationPlaying = false;
                return;
            }

            const [x, y] = cells[i++];

            this.ctx.fillStyle = (x+y)%2 === 0 ? Color.WON_DARK_CHECKER : Color.WON_LIGHT_CHECKER;
            this.ctx.fillRect(x* this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);

        }, 15);
    }

    updateLabels(option: number)
    {
        if(option === 0)
            this.mineCounterLabel.innerText = this.engine.flagsLeft().toString();
        else
            this.timerLabel.innerText = this.engine.getTimeElapsed().toFixed(1);
    }
    
    draw()
    {
        this.ctx.textAlign = "left";
        this.ctx.textBaseline = "top";
        this.ctx.font = `bold ${Math.floor(this.cellSize*0.5)}px sans-serif`;
        
        for(let r = 0; r < this.engine.rows; r++)
        {
            for(let c = 0; c < this.engine.cols; c++)
            {
                this.ctx.fillStyle = this.engine.getBackgroundColor([c, r]);   
                this.ctx.fillRect(this.cellSize * c, this.cellSize * r, this.cellSize, this.cellSize);

                if(this.engine.board[r][c] & Cell.IS_FLAGGED)
                {
                    this.ctx.drawImage(FLAG_IMAGE_ASSET, this.cellSize*c, this.cellSize*r, this.cellSize, this.cellSize);
                }
                else if(this.engine.board[r][c] & Cell.IS_MINE && this.engine.board[r][c] & Cell.IS_REVEALED)
                {
                    this.drawMine([c, r]);
                }
                // else if(this.engine.board[r][c] & Cell.IS_MINE)
                // {
                //     this.ctx.fillStyle = "red";
                //     this.ctx.fillText("M", this.cellSize *c + this.cellSize/4, this.cellSize * r + this.cellSize/4 );
                // }
                else if(!this.engine.won && this.engine.board[r][c] & Cell.IS_REVEALED)
                {
                    this.ctx.fillStyle = this.engine.getFontColor([c,r]);
                    this.ctx.font = "Google Sans";

                    const label = this.engine.getMines([c, r]).toString();

                    const metrics = this.ctx.measureText(label);
                    const textWidth = metrics.width;
                    const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

                    const xOffset = (this.cellSize - textWidth)/2
                    const yOffset = (this.cellSize - textHeight)/2;

                    this.ctx.fillText(label, this.cellSize *c + xOffset, this.cellSize * r + yOffset);
                }

            }
        }
    }

    private teetherClick(e: MouseEvent, preview: boolean = false)
    {
        e.preventDefault();

        if(this.engine.gameOver) return;

        const rect = this.board.getBoundingClientRect();

        const c = Math.floor((e.clientX - rect.left)/this.cellSize);
        const r = Math.floor((e.clientY - rect.top)/this.cellSize);

        const highlightedCells = this.engine.teether([c, r], preview);

        // console.log(JSON.stringify(highlightedCells));
        // const overlayCtx = this.overlay.getContext("2d")!;
        this.overlayCtx.fillStyle = "rgba(255, 255, 255, 0.3)";

        //2, 5

        const holdClickAbortController = new AbortController();

        for(const [cx, cy] of highlightedCells)
        {   
            this.overlayCtx.fillRect(cx * this.cellSize, cy * this.cellSize, this.cellSize, this.cellSize);
            
            
        }
        
        window.addEventListener("mouseup", ()=>{

            this.overlayCtx.clearRect(0, 0, this.overlay.width, this.overlay.height);

            holdClickAbortController.abort();
        }, { signal: holdClickAbortController.signal});
        
        this.step([c, r], true);
    }

    darken()
    {
        // const overlayCtx = this.overlay.getContext("2d")!;
        this.overlayCtx.fillStyle = "rgba(74, 73, 73, 0.82)";
        this.overlayCtx.fillRect(0,0, this.cellSize * this.engine.cols, this.cellSize * this.engine.rows);

    }

    showScoreboard()
    {
        
        // this.overlay.classList.add("darken");

        const redoParagraph: HTMLParagraphElement = document.getElementById("redopara")! as HTMLParagraphElement;


        this.darken();

        this.scoreboard.classList.remove("hidden");
        this.scoreboard.classList.add("shown");

        redoParagraph.innerText = this.engine.getStatus() === Status.WON ? "Play Again" : "Try Again"
        
        this.currentTimeScoreboardLabel.innerText = this.engine.getStatus() === Status.WON ? this.engine.getTimeElapsed().toString() : "---";
        this.bestTimeScoreboardLabel.innerText = `${Scoreboard.getBestTime(this.engine.difficulty) ?? "---"}`;
    }
}



const difficultySelection: HTMLSelectElement = document.getElementById("difficultySelection")! as HTMLSelectElement;
difficultySelection.selectedIndex = 1;

const redoBtn: HTMLButtonElement = document.getElementById("redo")! as HTMLButtonElement;


let gui = new GUI();
gui.draw();


const restart = () => {
    const difficulty: Difficulty = difficultySelection.options[difficultySelection.selectedIndex].value.toUpperCase() as Difficulty;

    gui.cleanUp();
    gui.animationPlaying = false;

    gui = new GUI(difficulty);

    gui.draw();
}

redoBtn.onclick = restart;

difficultySelection.addEventListener("change", restart);

// const solverBtn = document.getElementById("solver")!;

// solverBtn.onclick = () =>
// {
//     // console.log(JSON.stringify(gui.engine));
//     const solver = new Solver(gui.engine);

//     solver.solveStep(gui);

//     gui.erase(false);
//     gui.draw()
    
//     gui.updateLabels(0);
//     gui.updateLabels(1);
// }
