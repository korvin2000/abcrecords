/**
 * The order in which pages get painted, and how many at once.
 *
 * Every page inside the viewer's render window used to call `page.render()`
 * the moment it was mounted — six or seven of them together on a phone, each
 * decoding its own full-resolution scan. That is where the memory went
 * (docs/performance-analysis.md §3.3, M-2): the pixels on screen are small,
 * the bitmaps being decoded to produce them are not.
 *
 * So rendering goes through one queue per open document: at most `limit` pages
 * are in flight, and whenever a slot frees, it goes to the waiting page
 * nearest the one the reader is on — not to whichever effect happened to run
 * first. A page that scrolls away before its turn simply leaves the queue.
 */

interface Job {
  page: number;
  run: () => Promise<void>;
  /** Frees this job's slot. Set while the job is running; idempotent. */
  release?: () => void;
}

export class RenderQueue {
  /** Pages painted at the same time. Settable: the machine's grade can change
   *  once, shortly after load, and the viewer follows it. */
  limit = 1;

  private running = 0;
  private readonly waiting: Job[] = [];
  private readonly focus: () => number;

  /** @param focus The page the reader is on right now — asked at the moment a
   *  slot frees, so the answer is never stale. */
  constructor(focus: () => number) {
    this.focus = focus;
  }

  /**
   * Ask for a turn. Returns a function that gives the turn up: a request still
   * waiting is withdrawn, and one already running **frees its slot at once**.
   *
   * The second half matters. A job's first act is to ask pdf.js for the page,
   * which on a frugal load is a range request — and a stalled request never
   * settles. If the slot were held until `run` finished, one page scrolled
   * away from on a bad connection would block every page after it for as long
   * as the document is open. The caller still owns cancelling the work itself;
   * the queue only stops waiting for it.
   */
  add(page: number, run: () => Promise<void>): () => void {
    const job: Job = { page, run };
    this.waiting.push(job);
    // A microtask, not now: a commit mounts several pages at once, and the
    // first slot should go to the nearest of *all* of them.
    queueMicrotask(() => this.pump());
    return () => {
      const at = this.waiting.indexOf(job);
      if (at !== -1) this.waiting.splice(at, 1);
      job.release?.();
    };
  }

  private pump(): void {
    while (this.running < this.limit && this.waiting.length > 0) {
      const focus = this.focus();
      let best = 0;
      for (let i = 1; i < this.waiting.length; i++) {
        if (Math.abs(this.waiting[i].page - focus) < Math.abs(this.waiting[best].page - focus)) best = i;
      }
      const [job] = this.waiting.splice(best, 1);

      this.running += 1;
      let held = true;
      job.release = () => {
        if (!held) return;
        held = false;
        this.running -= 1;
        this.pump();
      };
      job.run().then(job.release, job.release);
    }
  }
}
