import { PencilLine, Users } from "lucide-react";
import { Flower, Landscape, Signpost, Star, Trophy } from "../Illustrations";

const MAP_WIDTH = 360;
const MAP_HEIGHT = 300;

const at = (x: number, y: number) => ({ left: `${(x / MAP_WIDTH) * 100}%`, top: `${(y / MAP_HEIGHT) * 100}%` });

const DONE_PATH = "M-12 286C14 268 34 254 64 246S124 236 150 218 210 186 196 150";
const OPEN_PATHS = ["M196 150C176 118 236 96 270 70"];

/**
 * The quiz trail from the mockup, used as an illustration of "Vorbereiten → Code teilen → Losrätseln → Feiern".
 * Purely decorative: the steps are explained in text below.
 */
export function HomeTrail() {
  return <div className="rl-map rl-home-map" aria-hidden="true">
    <Landscape className="rl-map-landscape" preserveAspectRatio="xMidYMid slice" />
    <svg className="rl-map-path" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}>
      <path d={DONE_PATH} className="rl-path-shadow" />
      <path d={DONE_PATH} className="rl-path-done" />
      {OPEN_PATHS.map((d) => <path key={d} d={d} className="rl-path-open" />)}
    </svg>
    <Signpost className="rl-deco rl-signpost" style={at(300, 238)} />
    <Flower className="rl-deco rl-flower" style={at(30, 196)} />
    <Star className="rl-deco rl-star" style={at(92, 54)} />
    <Star className="rl-deco rl-star rl-star-small" style={at(160, 112)} />
    <div className="rl-goal rl-home-goal" style={at(276, 62)}><Trophy className="rl-trophy" /></div>
    <span className="rl-node rl-node-done rl-home-node" style={at(64, 246)}>
      <span className="rl-node-face"><PencilLine strokeWidth={3} /></span>
    </span>
    <span className="rl-node rl-node-done rl-home-node" style={at(150, 218)}>
      <span className="rl-node-face"><Users strokeWidth={3} /></span>
    </span>
    <span className="rl-node rl-node-current rl-home-node-current" style={at(196, 150)}>
      <span className="rl-pulse" />
      <span className="rl-pulse rl-pulse-late" />
      <span className="rl-node-face">?</span>
    </span>
  </div>;
}
