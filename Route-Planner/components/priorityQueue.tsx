// Queue element class to store item and priority together in priority queue
class QueueElement<T> {
    constructor(public item: T, public priority: number) {
        this.item = item;
        this.priority = priority;
    }
}

// Implementation of priority queue data structure using a min-heap for A* algorithm 
// Lower priority number = higher priority in queue
export class PriorityQueue<T> {
    // Internal array to store queue elements as a binary tree
    private items: Array<QueueElement<T>>;

    // Initialises empty queue
    constructor() {
        this.items = new Array<QueueElement<T>>();
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

    private returnLeftChild(index: number): QueueElement<T> {
        return this.items[this.getLeftChildIndex(index)];
    }

    private returnRightChild(index: number): QueueElement<T> {
        return this.items[this.getRightChildIndex(index)];
    }

    private returnParent(index: number): QueueElement<T> {
        return this.items[this.getParentIndex(index)];
    }

    // Swaps two elements in the internal array given their indices
    private swap(indexOne: number, indexTwo: number) {
        const temp = this.items[indexOne];
        this.items[indexOne] = this.items[indexTwo];
        this.items[indexTwo] = temp;
    }

    public enqueue(item: T, priority: number) {
        // Adds new element to end of array
        this.items.push(new QueueElement<T>(item, priority));

        // Moves newly added element to its correct position higher in tree
        this.heapifyUp();
    }


    public dequeue(): T | null {
        // If queue is empty, return null
        if (this.isEmpty()) {
            return null;
        }

        // Saves item with highest priority at root
        const root = this.items[0].item;

        // Swap first and last element, remove last element (old root) from array
        this.items[0] = this.items[this.size() - 1];
        this.items.pop();

        // Moves new root element to correct position lower in tree 
        this.heapifyDown();
        return root;
    }

    public emptyQueue() {
        this.items = new Array<QueueElement<T>>();
    }

    // Moves newly added element to its correct position higher in tree
    private heapifyUp() {
        let index = this.items.length - 1;

        // Loops up tree until new element becomes root node or in correct position
        while (this.hasParent(index) && this.returnParent(index).priority > this.items[index].priority) {
            const parentIndex = this.getParentIndex(index);
            this.swap(parentIndex, index);
            index = parentIndex;
        }
    }

    // Moves root element to correct position lower in tree after swapped from remove operation
    private heapifyDown() {
        let index = 0;

        // Loops down tree until no children or root node in correct position
        while (this.hasLeftChild(index)) {
            // Determines which child has higher priority (lower priority number) to swap with
            let smallerChildIndex = this.getLeftChildIndex(index);
            if (this.hasRightChild(index) && this.returnRightChild(index).priority < this.returnLeftChild(index).priority) {
                smallerChildIndex = this.getRightChildIndex(index);
            }

            // Stops process as smallest element is parent node
            if (this.items[index].priority < this.items[smallerChildIndex].priority) {
                break;
            }

            // Swaps parent with smaller child
            this.swap(index, smallerChildIndex);

            // Continues down tree with new index of swapped element
            index = smallerChildIndex;
        }
    }
}