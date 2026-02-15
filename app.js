/* ============================================================
   Sudoku App — UI Controller
   ============================================================ */
(() => {
    'use strict';

    /* ---------- state ---------- */
    const state = {
        board: null,       // 9×9 current values  (0 = empty)
        solution: null,    // 9×9 solution
        given: null,       // 9×9 bool — true if cell was pre-filled
        notes: null,       // 9×9 array of Sets
        selectedRow: -1,
        selectedCol: -1,
        mistakes: 0,
        maxMistakes: 3,
        notesMode: false,
        timer: 0,
        timerInterval: null,
        paused: false,
        history: [],
        difficulty: '',
        difficultyLabel: '',
        gameOver: false,
        won: false,
    };

    /* ---------- DOM refs ---------- */
    const $ = (s, p) => (p || document).querySelector(s);
    const $$ = (s, p) => [...(p || document).querySelectorAll(s)];

    const menuScreen = $('#menu-screen');
    const gameScreen = $('#game-screen');
    const grid = $('#sudoku-grid');
    const numberPad = $('#number-pad');
    const timerEl = $('#timer');
    const diffBadge = $('#difficulty-label');
    const loadingOverlay = $('#loading-overlay');
    const pauseOverlay = $('#pause-overlay');
    const gameoverOverlay = $('#gameover-overlay');
    const victoryOverlay = $('#victory-overlay');

    /* ---------- init ---------- */
    function init() {
        buildGrid();
        buildNumberPad();
        buildSpecialPuzzles();
        bindEvents();
    }

    /* ---------- grid construction ---------- */
    function buildGrid() {
        grid.innerHTML = '';
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = r;
                cell.dataset.col = c;

                // value
                const val = document.createElement('span');
                val.className = 'cell-value';
                cell.appendChild(val);

                // notes 3×3
                const notesDiv = document.createElement('div');
                notesDiv.className = 'cell-notes';
                for (let n = 1; n <= 9; n++) {
                    const ns = document.createElement('span');
                    ns.dataset.note = n;
                    notesDiv.appendChild(ns);
                }
                cell.appendChild(notesDiv);

                grid.appendChild(cell);
            }
        }
    }

    /* ---------- number pad ---------- */
    function buildNumberPad() {
        numberPad.innerHTML = '';
        for (let n = 1; n <= 9; n++) {
            const btn = document.createElement('button');
            btn.className = 'num-btn';
            btn.dataset.num = n;
            btn.innerHTML = `<span class="num-btn-value">${n}</span><span class="num-btn-count"></span>`;
            numberPad.appendChild(btn);
        }
    }

    /* ---------- special puzzles list ---------- */
    function buildSpecialPuzzles() {
        const container = $('#special-puzzles');
        container.innerHTML = '';
        const icons = ['👑', '⚡', '🔥', '🐌', '💎', '🥇', '👹'];
        SudokuEngine.SPECIAL_PUZZLES.forEach((sp, i) => {
            const btn = document.createElement('button');
            btn.className = 'special-btn';
            btn.dataset.index = i;
            btn.innerHTML = `
                <div class="special-btn-icon">${icons[i] || '★'}</div>
                <div class="special-btn-text">
                    <span class="special-btn-name">${sp.name}</span>
                    <span class="special-btn-desc">${sp.subtitle}</span>
                </div>`;
            container.appendChild(btn);
        });
    }

    /* ============================================================
       EVENT BINDING
       ============================================================ */
    function bindEvents() {
        // menu — difficulty
        $('#difficulty-buttons').addEventListener('click', e => {
            const btn = e.target.closest('.diff-btn');
            if (!btn) return;
            startNewGame(btn.dataset.difficulty);
        });

        // menu — special
        $('#special-puzzles').addEventListener('click', e => {
            const btn = e.target.closest('.special-btn');
            if (!btn) return;
            startSpecialGame(parseInt(btn.dataset.index));
        });

        // grid clicks
        grid.addEventListener('click', e => {
            const cell = e.target.closest('.cell');
            if (!cell || state.gameOver || state.won || state.paused) return;
            selectCell(+cell.dataset.row, +cell.dataset.col);
        });

        // number pad
        numberPad.addEventListener('click', e => {
            const btn = e.target.closest('.num-btn');
            if (!btn || btn.classList.contains('disabled')) return;
            if (state.gameOver || state.won || state.paused) return;
            handleNumberInput(+btn.dataset.num);
        });

        // action buttons
        $('#btn-undo').addEventListener('click', undo);
        $('#btn-erase').addEventListener('click', eraseCell);
        $('#btn-notes').addEventListener('click', toggleNotesMode);

        // header
        $('#btn-back').addEventListener('click', backToMenu);
        $('#btn-pause').addEventListener('click', togglePause);

        // overlay buttons
        $('#btn-resume').addEventListener('click', togglePause);
        $('#btn-retry').addEventListener('click', retryGame);
        $('#btn-gameover-menu').addEventListener('click', backToMenu);
        $('#btn-new-game').addEventListener('click', () => backToMenu());
        $('#btn-victory-menu').addEventListener('click', backToMenu);

        // keyboard
        document.addEventListener('keydown', onKeyDown);
    }

    /* ---------- keyboard ---------- */
    function onKeyDown(e) {
        if (menuScreen.classList.contains('active')) return;
        if (state.gameOver || state.won) return;

        // pause
        if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
            e.preventDefault();
            togglePause();
            return;
        }

        if (state.paused) return;

        // arrows / WASD
        const dirMap = {
            ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
            w: [-1, 0], s: [1, 0], a: [0, -1], d: [0, 1],
            W: [-1, 0], S: [1, 0], A: [0, -1], D: [0, 1],
        };
        if (dirMap[e.key]) {
            e.preventDefault();
            const [dr, dc] = dirMap[e.key];
            moveSelection(dr, dc);
            return;
        }

        // numbers 1-9
        if (e.key >= '1' && e.key <= '9') {
            e.preventDefault();
            handleNumberInput(+e.key);
            return;
        }

        // delete / backspace
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            eraseCell();
            return;
        }

        // notes toggle
        if (e.key === 'n' || e.key === 'N') {
            e.preventDefault();
            toggleNotesMode();
            return;
        }

        // undo
        if ((e.ctrlKey && e.key === 'z') || e.key === 'z' || e.key === 'Z') {
            if (e.key === 'Z' && !e.ctrlKey) return; // capital Z without ctrl = skip
            e.preventDefault();
            undo();
            return;
        }
    }

    /* ============================================================
       GAME LIFECYCLE
       ============================================================ */
    function showScreen(name) {
        menuScreen.classList.toggle('active', name === 'menu');
        gameScreen.classList.toggle('active', name === 'game');
    }

    function startNewGame(difficulty) {
        const labels = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert', insane: 'Insane' };
        state.difficulty = difficulty;
        state.difficultyLabel = labels[difficulty];

        showLoading();
        setTimeout(() => {
            const result = SudokuEngine.generate(difficulty);
            beginGame(result.puzzle, result.solution);
            hideLoading();
        }, 60);
    }

    function startSpecialGame(index) {
        const sp = SudokuEngine.getSpecialPuzzle(index);
        state.difficulty = 'special';
        state.difficultyLabel = sp.name;
        beginGame(sp.puzzle, sp.solution);
    }

    function beginGame(puzzle, solution) {
        state.board = SudokuEngine.copyBoard(puzzle);
        state.solution = solution;
        state.given = puzzle.map(r => r.map(v => v !== 0));
        state.notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
        state.selectedRow = -1;
        state.selectedCol = -1;
        state.mistakes = 0;
        state.notesMode = false;
        state.history = [];
        state.gameOver = false;
        state.won = false;
        state.timer = 0;
        state.paused = false;

        diffBadge.textContent = state.difficultyLabel;
        $('#btn-notes').classList.remove('active');
        resetHearts();
        updateTimer();
        startTimer();
        renderFullGrid();
        updateNumberCounts();
        showScreen('game');
        hideAllOverlays();
    }

    function retryGame() {
        // restart same puzzle
        hideAllOverlays();
        const puzzle = state.given.map((row, r) =>
            row.map((isGiven, c) => isGiven ? state.solution[r][c] : 0)
        );
        beginGame(puzzle, state.solution);
    }

    function backToMenu() {
        stopTimer();
        hideAllOverlays();
        showScreen('menu');
    }

    /* ============================================================
       RENDERING
       ============================================================ */
    function renderFullGrid() {
        const cells = $$('.cell', grid);
        cells.forEach(cell => {
            const r = +cell.dataset.row;
            const c = +cell.dataset.col;
            updateCellDisplay(cell, r, c);
        });
        updateHighlights();
    }

    function updateCellDisplay(cell, r, c) {
        const v = state.board[r][c];
        const isGiven = state.given[r][c];

        // classes
        cell.classList.toggle('given', isGiven);
        cell.classList.toggle('has-value', v !== 0);
        cell.classList.remove('mistake');

        // value
        const valEl = $('.cell-value', cell);
        valEl.textContent = v !== 0 ? v : '';

        // notes
        const notesDiv = $('.cell-notes', cell);
        const noteSpans = $$('.cell-notes span', cell);
        for (let n = 1; n <= 9; n++) {
            noteSpans[n - 1].textContent = state.notes[r][c].has(n) ? n : '';
        }
    }

    function getCellEl(r, c) {
        return $(`.cell[data-row="${r}"][data-col="${c}"]`, grid);
    }

    function updateHighlights() {
        const cells = $$('.cell', grid);
        const sr = state.selectedRow;
        const sc = state.selectedCol;
        const selectedVal = (sr >= 0 && sc >= 0) ? state.board[sr][sc] : 0;

        cells.forEach(cell => {
            const r = +cell.dataset.row;
            const c = +cell.dataset.col;

            cell.classList.remove('selected', 'highlighted', 'same-number');

            if (sr < 0 || sc < 0) return;

            if (r === sr && c === sc) {
                cell.classList.add('selected');
            } else if (r === sr || c === sc ||
                (Math.floor(r / 3) === Math.floor(sr / 3) &&
                    Math.floor(c / 3) === Math.floor(sc / 3))) {
                cell.classList.add('highlighted');
            }

            if (selectedVal !== 0 && state.board[r][c] === selectedVal && !(r === sr && c === sc)) {
                cell.classList.add('same-number');
            }
        });
    }

    function updateNumberCounts() {
        const counts = Array(10).fill(0);
        for (let r = 0; r < 9; r++)
            for (let c = 0; c < 9; c++)
                if (state.board[r][c] !== 0)
                    counts[state.board[r][c]]++;

        $$('.num-btn', numberPad).forEach(btn => {
            const n = +btn.dataset.num;
            const remaining = 9 - counts[n];
            btn.classList.toggle('disabled', remaining <= 0);
            const countEl = $('.num-btn-count', btn);
            countEl.textContent = remaining > 0 ? remaining : '';
        });
    }

    /* ============================================================
       CELL SELECTION
       ============================================================ */
    function selectCell(r, c) {
        state.selectedRow = r;
        state.selectedCol = c;
        updateHighlights();
    }

    function moveSelection(dr, dc) {
        let r = state.selectedRow + dr;
        let c = state.selectedCol + dc;
        if (r < 0) r = 8; if (r > 8) r = 0;
        if (c < 0) c = 8; if (c > 8) c = 0;
        selectCell(r, c);
    }

    /* ============================================================
       NUMBER INPUT
       ============================================================ */
    function handleNumberInput(num) {
        const r = state.selectedRow;
        const c = state.selectedCol;
        if (r < 0 || c < 0) return;
        if (state.given[r][c]) return;

        if (state.notesMode) {
            toggleNote(r, c, num);
        } else {
            placeNumber(r, c, num);
        }
    }

    function placeNumber(r, c, num) {
        const prevVal = state.board[r][c];
        const prevNotes = new Set(state.notes[r][c]);

        // if same number already placed, do nothing
        if (prevVal === num) return;

        // push history
        state.history.push({
            type: 'place',
            row: r, col: c,
            prevVal,
            prevNotes,
            clearedNotes: [],  // populated below
        });

        // check correctness
        const correct = (num === state.solution[r][c]);

        state.board[r][c] = num;
        state.notes[r][c].clear();

        const cell = getCellEl(r, c);

        if (!correct) {
            // mistake
            state.mistakes++;
            cell.classList.add('mistake');
            cell.classList.add('error-flash');
            setTimeout(() => cell.classList.remove('error-flash'), 600);
            updateHearts();

            if (state.mistakes >= state.maxMistakes) {
                state.gameOver = true;
                stopTimer();
                setTimeout(showGameOver, 700);
            }
        } else {
            // correct — auto-clear notes in row/col/box
            const cleared = clearNotesForPlacement(r, c, num);
            state.history[state.history.length - 1].clearedNotes = cleared;
        }

        updateCellDisplay(cell, r, c);
        updateHighlights();
        updateNumberCounts();

        // check win
        if (!state.gameOver && checkWin()) {
            state.won = true;
            stopTimer();
            setTimeout(showVictory, 500);
        }
    }

    function toggleNote(r, c, num) {
        if (state.board[r][c] !== 0) return; // cell has value

        const prevNotes = new Set(state.notes[r][c]);
        if (state.notes[r][c].has(num)) {
            state.notes[r][c].delete(num);
        } else {
            state.notes[r][c].add(num);
        }

        state.history.push({
            type: 'note',
            row: r, col: c,
            prevNotes,
        });

        const cell = getCellEl(r, c);
        updateCellDisplay(cell, r, c);
    }

    function eraseCell() {
        const r = state.selectedRow;
        const c = state.selectedCol;
        if (r < 0 || c < 0) return;
        if (state.given[r][c]) return;
        if (state.gameOver || state.won) return;

        const prevVal = state.board[r][c];
        const prevNotes = new Set(state.notes[r][c]);

        if (prevVal === 0 && prevNotes.size === 0) return;

        state.history.push({
            type: 'erase',
            row: r, col: c,
            prevVal,
            prevNotes,
        });

        state.board[r][c] = 0;
        state.notes[r][c].clear();

        const cell = getCellEl(r, c);
        cell.classList.remove('mistake');
        updateCellDisplay(cell, r, c);
        updateHighlights();
        updateNumberCounts();
    }

    /* ---------- auto-clear notes ---------- */
    function clearNotesForPlacement(row, col, num) {
        const cleared = [];
        for (let i = 0; i < 9; i++) {
            // row
            if (state.notes[row][i].has(num)) {
                cleared.push({ r: row, c: i, num });
                state.notes[row][i].delete(num);
                updateCellDisplay(getCellEl(row, i), row, i);
            }
            // col
            if (state.notes[i][col].has(num)) {
                cleared.push({ r: i, c: col, num });
                state.notes[i][col].delete(num);
                updateCellDisplay(getCellEl(i, col), i, col);
            }
        }
        // box
        const br = Math.floor(row / 3) * 3;
        const bc = Math.floor(col / 3) * 3;
        for (let r = br; r < br + 3; r++) {
            for (let c = bc; c < bc + 3; c++) {
                if (state.notes[r][c].has(num)) {
                    cleared.push({ r, c, num });
                    state.notes[r][c].delete(num);
                    updateCellDisplay(getCellEl(r, c), r, c);
                }
            }
        }
        return cleared;
    }

    /* ============================================================
       UNDO
       ============================================================ */
    function undo() {
        if (state.history.length === 0) return;
        if (state.gameOver || state.won) return;

        const entry = state.history.pop();
        const cell = getCellEl(entry.row, entry.col);

        if (entry.type === 'place') {
            // if the placement was a mistake, restore the mistake count
            if (entry.prevVal !== state.board[entry.row][entry.col] || true) {
                const wasCorrect = (state.board[entry.row][entry.col] === state.solution[entry.row][entry.col]);
                if (!wasCorrect) {
                    state.mistakes = Math.max(0, state.mistakes - 1);
                    updateHearts();
                }
            }

            state.board[entry.row][entry.col] = entry.prevVal;
            state.notes[entry.row][entry.col] = new Set(entry.prevNotes);

            // restore cleared notes
            if (entry.clearedNotes) {
                for (const cn of entry.clearedNotes) {
                    state.notes[cn.r][cn.c].add(cn.num);
                    updateCellDisplay(getCellEl(cn.r, cn.c), cn.r, cn.c);
                }
            }

            cell.classList.remove('mistake');
        } else if (entry.type === 'note') {
            state.notes[entry.row][entry.col] = new Set(entry.prevNotes);
        } else if (entry.type === 'erase') {
            state.board[entry.row][entry.col] = entry.prevVal;
            state.notes[entry.row][entry.col] = new Set(entry.prevNotes);

            // re-apply mistake styling if needed
            if (entry.prevVal !== 0 && entry.prevVal !== state.solution[entry.row][entry.col]) {
                cell.classList.add('mistake');
            }
        }

        updateCellDisplay(cell, entry.row, entry.col);
        updateHighlights();
        updateNumberCounts();
    }

    /* ============================================================
       WIN CHECK
       ============================================================ */
    function checkWin() {
        for (let r = 0; r < 9; r++)
            for (let c = 0; c < 9; c++)
                if (state.board[r][c] !== state.solution[r][c])
                    return false;
        return true;
    }

    /* ============================================================
       TIMER
       ============================================================ */
    function startTimer() {
        stopTimer();
        state.timerInterval = setInterval(() => {
            if (!state.paused) {
                state.timer++;
                updateTimer();
            }
        }, 1000);
    }

    function stopTimer() {
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
    }

    function updateTimer() {
        const m = Math.floor(state.timer / 60);
        const s = state.timer % 60;
        timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function formatTimeLong(secs) {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        if (m === 0) return `${s} second${s !== 1 ? 's' : ''}`;
        return `${m} min ${s} sec`;
    }

    /* ============================================================
       HEARTS / MISTAKES
       ============================================================ */
    function resetHearts() {
        for (let i = 0; i < 3; i++) {
            const h = $(`#heart-${i}`);
            h.className = 'heart active';
        }
    }

    function updateHearts() {
        for (let i = 0; i < 3; i++) {
            const h = $(`#heart-${i}`);
            if (i < (3 - state.mistakes)) {
                h.className = 'heart active';
            } else if (i === (3 - state.mistakes)) {
                h.className = 'heart losing';
                setTimeout(() => { h.className = 'heart'; }, 500);
            } else {
                h.className = 'heart';
            }
        }
    }

    /* ============================================================
       PAUSE
       ============================================================ */
    function togglePause() {
        if (state.gameOver || state.won) return;

        state.paused = !state.paused;

        if (state.paused) {
            grid.style.filter = 'blur(12px)';
            grid.style.pointerEvents = 'none';
            showOverlay(pauseOverlay);
        } else {
            grid.style.filter = '';
            grid.style.pointerEvents = '';
            hideOverlay(pauseOverlay);
        }
    }

    /* ============================================================
       NOTES MODE
       ============================================================ */
    function toggleNotesMode() {
        state.notesMode = !state.notesMode;
        $('#btn-notes').classList.toggle('active', state.notesMode);
    }

    /* ============================================================
       OVERLAYS
       ============================================================ */
    function showOverlay(el) { el.classList.add('active'); }
    function hideOverlay(el) { el.classList.remove('active'); }

    function hideAllOverlays() {
        [loadingOverlay, pauseOverlay, gameoverOverlay, victoryOverlay].forEach(o =>
            o.classList.remove('active'));
        grid.style.filter = '';
        grid.style.pointerEvents = '';
    }

    function showLoading() { showOverlay(loadingOverlay); }
    function hideLoading() { hideOverlay(loadingOverlay); }

    function showGameOver() {
        $('#gameover-time').textContent = `Time: ${formatTimeLong(state.timer)}`;
        showOverlay(gameoverOverlay);
    }

    function showVictory() {
        $('#victory-difficulty').textContent = state.difficultyLabel;
        $('#victory-time').textContent = `Time: ${formatTimeLong(state.timer)}`;
        const m = state.mistakes;
        $('#victory-mistakes').textContent = m === 0 ? 'No mistakes — Perfect!' : `Mistakes: ${m}/3`;
        showOverlay(victoryOverlay);
    }

    /* ============================================================
       BOOT
       ============================================================ */
    init();
})();
