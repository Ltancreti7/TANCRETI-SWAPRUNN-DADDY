interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  style?: React.CSSProperties;
}

export function Card({ children, className = '', onClick, hover = false, style }: CardProps) {
  const baseClasses = 'bg-white border border-gray-200 rounded-lg p-4 transition-all';
  const hoverClasses = hover
    ? 'hover:border-red-600 hover:shadow-md cursor-pointer'
    : '';
  const clickableClasses = onClick ? 'cursor-pointer' : '';

  return (
    <div
      className={`${baseClasses} ${hoverClasses} ${clickableClasses} ${className}`}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  );
}
