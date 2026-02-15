/* ============================================================
   Sudoku Engine — solver, generator, validator, special puzzles
   ============================================================ */
const SudokuEngine = (() => {

    /* ---------- helpers ---------- */
    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function copyBoard(b) { return b.map(r => [...r]); }

    /* ---------- validation ---------- */
    function isValid(board, row, col, num) {
        for (let c = 0; c < 9; c++) if (board[row][c] === num) return false;
        for (let r = 0; r < 9; r++) if (board[r][col] === num) return false;
        const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
        for (let r = br; r < br + 3; r++)
            for (let c = bc; c < bc + 3; c++)
                if (board[r][c] === num) return false;
        return true;
    }

    /* ---------- solver (backtracking) ---------- */
    function solve(board) {
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === 0) {
                    for (let n = 1; n <= 9; n++) {
                        if (isValid(board, r, c, n)) {
                            board[r][c] = n;
                            if (solve(board)) return true;
                            board[r][c] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }

    function solveCopy(board) {
        const b = copyBoard(board);
        return solve(b) ? b : null;
    }

    /* ---------- count solutions (up to limit) ---------- */
    function countSolutions(board, limit) {
        limit = limit || 2;
        let count = 0;

        // find cell with fewest candidates for speed
        function findBest(b) {
            let best = null, min = 10;
            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (b[r][c] === 0) {
                        let cnt = 0;
                        for (let n = 1; n <= 9; n++) if (isValid(b, r, c, n)) cnt++;
                        if (cnt < min) { min = cnt; best = [r, c]; }
                        if (min === 0) return best;
                    }
                }
            }
            return best;
        }

        function _solve(b) {
            if (count >= limit) return;
            const cell = findBest(b);
            if (!cell) { count++; return; }
            const [r, c] = cell;
            for (let n = 1; n <= 9; n++) {
                if (count >= limit) return;
                if (isValid(b, r, c, n)) {
                    b[r][c] = n;
                    _solve(b);
                    b[r][c] = 0;
                }
            }
        }

        _solve(copyBoard(board));
        return count;
    }

    /* ---------- generate complete board ---------- */
    function generateComplete() {
        const board = Array.from({ length: 9 }, () => Array(9).fill(0));

        function fill(b) {
            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (b[r][c] === 0) {
                        const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
                        for (const n of nums) {
                            if (isValid(b, r, c, n)) {
                                b[r][c] = n;
                                if (fill(b)) return true;
                                b[r][c] = 0;
                            }
                        }
                        return false;
                    }
                }
            }
            return true;
        }

        fill(board);
        return board;
    }

    /* ---------- generate puzzle ---------- */
    const DIFFICULTY_CONFIG = {
        easy: { min: 36, max: 42 },
        medium: { min: 30, max: 35 },
        hard: { min: 26, max: 30 },
        expert: { min: 22, max: 26 },
        insane: { min: 20, max: 24 },
    };

    function generate(difficulty) {
        const solution = generateComplete();
        const puzzle = copyBoard(solution);
        const cfg = DIFFICULTY_CONFIG[difficulty];
        const target = cfg.min + Math.floor(Math.random() * (cfg.max - cfg.min + 1));

        const positions = shuffle(
            Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9])
        );

        let givens = 81;
        for (const [r, c] of positions) {
            if (givens <= target) break;
            const backup = puzzle[r][c];
            puzzle[r][c] = 0;
            if (countSolutions(puzzle, 2) !== 1) {
                puzzle[r][c] = backup;
            } else {
                givens--;
            }
        }

        return { puzzle, solution };
    }

    /* ---------- parse puzzle string ---------- */
    function parseString(str) {
        const board = [];
        for (let r = 0; r < 9; r++) {
            board.push([]);
            for (let c = 0; c < 9; c++) {
                const ch = str[r * 9 + c];
                board[r].push(ch === '.' || ch === '0' ? 0 : parseInt(ch));
            }
        }
        return board;
    }

    /* ---------- special puzzles ---------- */
    const SPECIAL_PUZZLES = [
        {
            name: "Arto Inkala 2012",
            subtitle: "The Ultimate Challenge — June 2012",
            data: "8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..",
        },
        {
            name: "Arto Inkala 2010",
            subtitle: "\"World's Hardest Sudoku\"",
            data: "..53.....8......2..7..1.5..4....53...1..7...6..32...8..6.5....9..4....3......97..",
        },
        {
            name: "Arto Inkala 2006",
            subtitle: "The Original Hardest",
            data: "85...24..72......9..4.........1.7..23.5...9...4...........8..7..17..........36.4.",
        },
        {
            name: "AI Escargot",
            subtitle: "By Arto Inkala",
            data: "1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..41....7...7...3..",
        },
        {
            name: "Platinum Blonde",
            subtitle: "Notoriously Difficult",
            data: "..............3.85..1.2.......5.7.....4...1...9.......5......73..2.1........4...9.",
        },
        {
            name: "Golden Nugget",
            subtitle: "A Legendary Challenge",
            data: ".......39.....1..5..3.5.8....8.9...6.7...2...1..4.......9.8..5..2....6..4..7....",
        },
        {
            name: "Easter Monster",
            subtitle: "Fiendishly Complex",
            data: "1.......2.9.4...5...6...7...5.9.3.......7.......85..4.7.....6...3...9.8...2.....1",
        },
    ];

    function getSpecialPuzzle(index) {
        const sp = SPECIAL_PUZZLES[index];
        const puzzle = parseString(sp.data);
        const solution = solveCopy(puzzle);
        return { puzzle, solution, name: sp.name, subtitle: sp.subtitle };
    }

    /* ---------- public API ---------- */
    return {
        isValid,
        solve,
        solveCopy,
        countSolutions,
        generate,
        generateComplete,
        parseString,
        copyBoard,
        SPECIAL_PUZZLES,
        getSpecialPuzzle,
    };
})();
