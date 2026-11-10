// The animation engine framer-motion's LazyMotion loads after the page shows.
// Its own module, so the dynamic import is its own chunk (see Animate.tsx).
import { domAnimation } from "framer-motion";

export default domAnimation;
