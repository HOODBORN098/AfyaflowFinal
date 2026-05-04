import React from 'react';

interface DashboardCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'lowest' | 'low' | 'high' | 'highest';
  noPadding?: boolean;
  onClick?: () => void;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ 
  children, 
  className = '', 
  variant = 'lowest',
  noPadding = false,
  onClick
}) => {
  const variantClasses = {
    lowest: 'bg-surface-container-lowest',
    low: 'bg-surface-container-low',
    high: 'bg-surface-container-high',
    highest: 'bg-surface-container-highest',
  };

  return (
    <div 
      onClick={onClick}
      className={`
      ${variantClasses[variant]} 
      rounded-2xl
      ${noPadding ? '' : 'p-8'} 
      shadow-xl shadow-slate-200/40 dark:shadow-none 
      border border-slate-100 dark:border-slate-800
      hover:border-teal-500/30 dark:hover:border-teal-500/30
      transition-all duration-300
      ${className}
    `}>
      {children}
    </div>
  );
};

export default DashboardCard;
