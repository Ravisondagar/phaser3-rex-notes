import CellKlass from './Cell.js';
import PoolKlass from '../../pool.js';

const GetValue = Phaser.Utils.Objects.GetValue;
const SpliceOne = Phaser.Utils.Array.SpliceOne;

var CellsPool = new PoolKlass();
class Table {
    constructor(parent, config) {
        this.parent = parent; // parent: GridTable game object (Container)
        this.cells = [];
        this.resetFromJSON(config);
    }

    resetFromJSON(o) {
        this.colCount = undefined;
        this._nonZeroDeltaHeightCount = 0;
        this.resetTotalRowsHeight();
        this.setDefaultCellHeight(GetValue(o, 'cellHeight', 30));
        this.setDefaultCellWidth(GetValue(o, 'cellWidth', 30));
        this.initCells(GetValue(o, 'cellsCount', 0));
        this.setColumnCount(GetValue(o, 'columns', 1));
        return this;
    }

    destroy(fromScene) {
        for (var i = 0, cnt = this.cells.length; i < cnt; i++) {
            this.freeCell(this.cells[i], fromScene);
        }
        this.cells = undefined;
        this.parent = undefined;
    }

    get nonZeroDeltaHeightCount() {
        return this._nonZeroDeltaHeightCount;
    }

    set nonZeroDeltaHeightCount(count) {
        if (this._nonZeroDeltaHeightCount === count) {
            return;
        }
        this._nonZeroDeltaHeightCount = count;
        this.resetTotalRowsHeight();
    }

    get defaultCellHeightMode() {
        return (this.nonZeroDeltaHeightCount === 0);
    }

    setDefaultCellHeight(height) {
        this.defaultCellHeight = height;
        return this;
    }

    setDefaultCellWidth(width) {
        this.defaultCellWidth = width;
        return this;
    }

    initCells(size) {
        var cells = this.cells;
        cells.length = size;
        for (var i = 0; i < size; i++) {
            cells[i] = null;
        }
        return this;
    }

    insertNewCell(cellIdx, count) {
        var cells = this.cells;
        if (cellIdx === cells.length) {
            // append at end of array
            var endIdx = cellIdx + count;
            cells.legth = endIdx;
            for (var i = cellIdx; i < endIdx; i++) {
                cells[i] = null;
            }
        } else {
            var newCells = [];
            newCells.length = count;
            for (var i = 0; i < count; i++) {
                newCells[i] = null;
            }
            this.cells.splice(cellIdx, 0, ...newCells);
        }

        this.resetTotalRowsHeight();
        return this;
    }

    removeCell(cellIdx, count) {
        var endIdx = cellIdx + count;
        for (var i = cellIdx; i < endIdx; i++) {
            this.freeCell(i);
        }

        if (endIdx === this.cells.length) {
            // remove until end of array
            this.cells.length = cellIdx;
        } else {
            if (count === 1) {
                SpliceOne(this.cells, cellIdx);
            } else {
                this.cells.splice(cellIdx, count);
            }
            this.buildCellIndex(cellIdx);
        }

        this.resetTotalRowsHeight();
        return this;
    }

    setColumnCount(cnt) {
        this.colCount = cnt;
        this.resetTotalRowsHeight();
        return this;
    }

    get rowCount() {
        return Math.ceil(this.cells.length / this.colCount);
    }

    get cellsCount() {
        return this.cells.length;
    }

    isValidCellIdx(idx) {
        return ((idx >= 0) && (idx < this.cells.length));
    }

    heightToRowIndex(height, isCeil) {
        // defaultCellHeightMode
        if (this.defaultCellHeightMode) {
            var rowIdx = height / this.defaultCellHeight;
            if (isCeil) {
                rowIdx = Math.ceil(rowIdx);
            } else {
                rowIdx = Math.floor(rowIdx);
            }

            return rowIdx;
        }

        // count cell height one by one
        var rowCount = this.rowCount;
        var remainder = height,
            isValidIdx;
        var cell, rowHeight, rowIdx = 0;

        while (1) {
            rowHeight = this.getRowHeight(rowIdx);
            remainder -= rowHeight;

            isValidIdx = (rowIdx >= 0) && (rowIdx < rowCount);
            if ((remainder > 0) && isValidIdx) {
                rowIdx += 1;
            } else if (remainder === 0) {
                return rowIdx;
            } else {
                if (isCeil) {
                    var preRowIdx = rowIdx;
                    rowIdx += 1;
                    isValidIdx = (rowIdx >= 0) && (rowIdx < rowCount);

                    if (!isValidIdx)
                        rowIdx = preRowIdx;
                }

                return rowIdx;
            }
        }

    }

    widthToColIndex(width, isCeil) {
        var colIdx = width / this.defaultCellWidth;
        if (isCeil) {
            colIdx = Math.ceil(colIdx);
        } else {
            colIdx = Math.floor(colIdx);
        }

        return colIdx;
    }

    colRowToCellIndex(colIdx, rowIdx) {
        if (colIdx >= this.colCount) {
            return null;
        }
        return (rowIdx * this.colCount) + colIdx;
    }

    rowIndexToHeight(start, end) {
        // defaultCellHeightMode
        if (this.defaultCellHeightMode) {
            return (end - start + 1) * this.defaultCellHeight;
        }

        var h, sum = 0;
        for (var i = start; i <= end; i++) {
            h = this.getRowHeight(i);
            sum += h;
        }

        return sum;
    }

    colIndexToWidth(start, end) {
        return (end - start + 1) * this.defaultCellWidth;
    };

    getRowHeight(rowIdx) {
        var cnt = this.colCount;
        // single column
        if (cnt <= 1) {
            return this.getCellHeight(this.colRowToCellIndex(0, rowIdx));
        }

        // multiple columns, get the maximum height
        var maxHeight = 0,
            cellHeight;
        for (var i = 0; i < cnt; i++) {
            cellHeight = this.getCellHeight(this.colRowToCellIndex(i, rowIdx));
            if (maxHeight < cellHeight)
                maxHeight = cellHeight;
        }
        return maxHeight;
    }

    getColWidth(idx) {
        return this.defaultCellWidth;
    }

    getCellHeight(cellIdx) {
        if (!this.isValidCellIdx(cellIdx)) {
            return 0;
        }

        var cellHeight;
        if (this.defaultCellHeightMode)
            cellHeight = this.defaultCellHeight;
        else {
            var cell = this.getCell(cellIdx, false);
            var deltaHeight = (cell) ? cell.deltaHeight : 0;
            cellHeight = this.defaultCellHeight + deltaHeight;
        }

        return cellHeight;
    }

    resetTotalRowsHeight() {
        this._totalRowsHeight = null;
    }

    get totalRowsHeight() {
        if (this._totalRowsHeight === null) {
            this._totalRowsHeight = this.rowIndexToHeight(0, this.rowCount - 1);
        }

        return this._totalRowsHeight;
    }

    get totalColumnWidth() {
        return this.colCount * this.defaultCellWidth;
    }

    cellIndxeToColIndex(cellIdx) {
        return cellIdx % this.colCount;
    }

    cellIndxeToRowIndex(cellIdx) {
        return Math.floor(cellIdx / this.colCount);
    }

    getCell(cellIdx, createNewCell) {
        if (!this.isValidCellIdx(cellIdx)) {
            return null;
        }

        if (createNewCell === undefined) {
            createNewCell = true;
        }
        if ((this.cells[cellIdx] === null) && createNewCell) {
            var cell = this.newCell(cellIdx);
            this.cells[cellIdx] = cell;
        }

        return this.cells[cellIdx];
    }

    newCell(cellIdx) {
        var cell = CellsPool.pop();
        if (cell === null) {
            cell = new CellKlass(this);
        } else {
            cell.setParent(this);
        }
        cell.index = cellIdx;

        return cell;
    }

    buildCellIndex(startIdx) {
        if (startIdx === undefined) {
            startIdx = 0;
        }
        var cells = this.cells,
            cell;
        for (var i = startIdx, len = cells.length; i < len; i++) {
            cell = cells[i];
            if (cell) {
                cell.index = i;
            }
        }
        return this;
    }

    getParentContainer() {
        return this.parent;
    }

    freeCell(cell, fromScene) {
        if (typeof (cell) === 'number') {
            cell = this.cells[cell];
        }

        if (!cell) {
            return this;
        }

        cell.destroy(fromScene);
        CellsPool.push(cell);
        return this;
    }
}

export default Table;