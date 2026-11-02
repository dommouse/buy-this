import {
  BookOpen,
  Brain,
  ImageIcon,
  LayoutDashboard,
  Mail,
  Package,
  Settings,
  Shield,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/banners", label: "Banners", icon: ImageIcon },
  { to: "/admin/admins", label: "Admins", icon: Shield },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/newsletter", label: "Newsletter", icon: Mail },
  { to: "/admin/catalog", label: "Catalog", icon: Package },
  { to: "/admin/blogs", label: "Blogs", icon: BookOpen },
  { to: "/admin/gift-brain", label: "Gift Brain", icon: Brain },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/profile", label: "Profile", icon: UserRound },
];
