import { Link } from "react-router-dom";
import { Aperture, ArrowRight } from "lucide-react";

/** Fallback page (404 → here). The real experience is the single-page Home. */
export default function Landing() {
  return (
    <div className="relative overflow-x-clip">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-film/10 ring-1 ring-amber-film/30">
              <Aperture className="h-4 w-4 text-amber-film" strokeWidth={1.75} />
            </span>
            <span className="text-[13px] font-bold tracking-[0.16em] text-bone-100">
              DOCUMENTARY STUDIO
            </span>
          </Link>
        </div>
      </header>
      <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-6 text-center">
        <h1 className="font-serif text-5xl font-bold leading-tight text-bone-50">
          Page not found
        </h1>
        <p className="mt-4 max-w-md text-bone-300">
          The studio lives on one page now — everything is at the home URL.
        </p>
        <Link to="/" className="btn-primary mt-8 h-11 px-7 text-[15px]">
          Open the Studio <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
