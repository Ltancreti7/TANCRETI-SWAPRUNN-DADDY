import {
  Clock,
  UserCheck,
  Truck,
  CheckCircle,
  XCircle,
  ThumbsUp,
  Star,
  LucideIcon
} from 'lucide-react';

interface BadgeProps {
  status: 'pending' | 'pending_driver_acceptance' | 'accepted' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<
  string,
  { label: string; color: string; icon: LucideIcon }
> = {
  pending: {
    label: 'Pending',
    color: 'bg-red-50 text-red-600 border-red-200',
    icon: Clock,
  },
  pending_driver_acceptance: {
    label: 'Awaiting Response',
    color: 'bg-yellow-50 text-yellow-600 border-yellow-300',
    icon: Star,
  },
  accepted: {
    label: 'Accepted',
    color: 'bg-rose-50 text-rose-600 border-rose-200',
    icon: ThumbsUp,
  },
  assigned: {
    label: 'Assigned',
    color: 'bg-rose-50 text-rose-600 border-rose-200',
    icon: UserCheck,
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-red-100 text-red-700 border-red-300',
    icon: Truck,
  },
  completed: {
    label: 'Completed',
    color: 'bg-gray-100 text-gray-700 border-gray-300',
    icon: CheckCircle,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-gray-100 text-gray-700 border-gray-300',
    icon: XCircle,
  },
};

export function Badge({ status, showIcon = true, size = 'md' }: BadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-xs',
    lg: 'px-4 py-1.5 text-sm',
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold border ${config.color} ${sizeClasses[size]} transition-all`}
    >
      {showIcon && <Icon size={iconSizes[size]} />}
      {config.label}
    </span>
  );
}
