import { useState } from "react"

type Props = {
  text: string
  onClick?: () => void
  restClasses?: string
  disabled?: boolean
  tooltipText?: string,
}
const CustomButton = (props: Props) => {
  const [isHovered, setIsHovered] = useState(false);
  return (<div
  className="relative group inline-block"
  onMouseEnter={() => setIsHovered(true)}
  onMouseLeave={() => setIsHovered(false)}
>
  <button
    disabled={props.disabled}
    className={`w-[200px] rounded border border-indigo-600 bg-indigo-600 px-12 py-3 text-sm font-medium text-white hover:bg-transparent hover:text-indigo-600 focus:outline-none focus:ring active:text-indigo-500 ${props.disabled ? 'opacity-50 cursor-not-allowed' : ''} ${props.restClasses || ''}`}
    onClick={!props.disabled ? props.onClick : undefined}
  >
    {props.text}
  </button>
  {props.tooltipText && props.disabled && (
    <div
      className={`absolute w-full bottom-full transform -translate-x-1/2 mb-2 ${isHovered ? 'animate-slideIn' : 'animate-slideOut'} bg-gray-700 text-white text-xs rounded py-1 px-2 whitespace-no-wrap z-10 opacity-0 group-hover:opacity-100`}
    >
      {props.tooltipText}
    </div>
  )}
</div>
);  
}
export default CustomButton