class queueElement<T> {
    constructor(public item: T, public priority: number) {
        this.item = item;
        this.priority = priority;
    }
}
// Based on Min-Heap
// Lower priority number = higher priority in queue
export class PriorityQueue<T> {
    private items: Array<queueElement<T>>;

    constructor() {
        this.items = new Array<queueElement<T>>();
    }

    public size(): number {
        return this.items.length;
    }

    public isEmpty(): boolean {
        return this.items.length === 0;
    }

    private getLeftChildIndex(parentIndex: number): number {
        return 2 * parentIndex + 1;
    }

    private getRightChildIndex(parentIndex: number): number {
        return 2 * parentIndex + 2;
    }

    private getParentIndex(childIndex: number): number {
        return Math.floor((childIndex - 1) / 2);
    }

    private hasLeftChild(index: number): boolean {
        return this.getLeftChildIndex(index) < this.size();
    }

    private hasRightChild(index: number): boolean {
        return this.getRightChildIndex(index) < this.size();
    }

    private hasParent(index: number): boolean {
        return this.getParentIndex(index) >= 0;
    }

    private returnLeftChild(index: number): queueElement<T> {
        return this.items[this.getLeftChildIndex(index)];
    }

    private returnRightChild(index: number): queueElement<T> {
        return this.items[this.getRightChildIndex(index)];
    }

    private returnParent(index: number): queueElement<T> {
        return this.items[this.getParentIndex(index)];
    }

    private swap(indexOne: number, indexTwo: number) {
        const temp = this.items[indexOne];
        this.items[indexOne] = this.items[indexTwo];
        this.items[indexTwo] = temp;
    }

    public enqueue(item: T, priority: number) {
        this.items.push(new queueElement<T>(item, priority));
        this.heapifyUp();
    }

    public dequeue(): T | null {
        if (this.isEmpty()) {
            return null;
        }
        const item = this.items[0].item;
        this.items[0] = this.items[this.size() - 1];
        this.items.pop();
        this.heapifyDown();
        return item;
    }

    public emptyQueue() {
        this.items = new Array<queueElement<T>>();
    }

    // Move newly added element to its correct position higher in tree
    private heapifyUp() {
        let index = this.items.length - 1;
        while (this.hasParent(index) && this.returnParent(index).priority > this.items[index].priority) {
            const parentIndex = this.getParentIndex(index);
            this.swap(parentIndex, index);
            index = parentIndex;
        }
    }

    // Move root element to correct position lower in tree after swapped from remove operation
    private heapifyDown() {
        let index = 0;
        while (this.hasLeftChild(index)) {
            let smallerChildIndex = this.getLeftChildIndex(index);
            if (this.hasRightChild(index) && this.returnRightChild(index).priority < this.returnLeftChild(index).priority) {
                smallerChildIndex = this.getRightChildIndex(index);
            }
            if (this.items[index].priority < this.items[smallerChildIndex].priority) {
                break;
            }
            this.swap(index, smallerChildIndex);
            index = smallerChildIndex;
        }
    }
}