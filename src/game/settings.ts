import { create } from "zustand";

export type GameSettings = { quality: "auto" | "low" | "high"; sound: boolean; volume: number; reducedEffects: boolean; zoom: number; joystickSize: number; joystickX: number; joystickY: number; buttonsSize: number; buttonsX: number; buttonsY: number };
const defaults: GameSettings = { quality:"auto",sound:true,volume:.25,reducedEffects:false,zoom:1,joystickSize:112,joystickX:12,joystickY:12,buttonsSize:44,buttonsX:12,buttonsY:12 };
export const useGameSettings = create<GameSettings & { hydrate:()=>void; update:(patch:Partial<GameSettings>)=>void }>((set,get)=>({
  ...defaults,
  hydrate:()=>{ try { const saved=JSON.parse(localStorage.getItem("storm:settings")??"null"); if(saved) set({...defaults,...saved}); } catch { /* defaults */ } },
  update:(patch)=>{set(patch); const {hydrate,update,...values}=get(); void hydrate; void update; try { localStorage.setItem("storm:settings",JSON.stringify(values)); } catch { /* unavailable storage */ } },
}));

let audio: AudioContext | null = null;
export function attackSound(vocation:string) {
  const settings=useGameSettings.getState();
  if(!settings.sound || typeof window==="undefined") return;
  try {
    audio ??= new AudioContext();
    if(audio.state==="suspended") void audio.resume();
    const oscillator=audio.createOscillator(), gain=audio.createGain();
    const t=audio.currentTime;
    oscillator.type=vocation==="sorcerer"?"sawtooth":vocation==="druid"?"sine":"triangle";
    oscillator.frequency.setValueAtTime(vocation==="druid"?950:vocation==="paladin"?650:vocation==="sorcerer"?160:420,t);
    oscillator.frequency.exponentialRampToValueAtTime(vocation==="druid"?300:55,t+.22);
    gain.gain.setValueAtTime(settings.volume*.18,t); gain.gain.exponentialRampToValueAtTime(.001,t+.25);
    oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(t); oscillator.stop(t+.26);
  } catch { /* audio not supported */ }
}