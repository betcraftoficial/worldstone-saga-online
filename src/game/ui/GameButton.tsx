import type { ButtonHTMLAttributes } from "react";
export function GameButton({className="",...props}:ButtonHTMLAttributes<HTMLButtonElement>){
  return <button type="button" {...props} className={`btn-wood px-3 py-1.5 text-sm ${className}`} />;
}