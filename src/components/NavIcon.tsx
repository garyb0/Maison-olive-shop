"use client";

import {
  BadgePercent,
  Bell,
  Boxes,
  BriefcaseBusiness,
  CircleHelp,
  ClipboardList,
  Dog,
  Home,
  LayoutDashboard,
  LockKeyhole,
  MapPinned,
  PackageSearch,
  PawPrint,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Truck,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { NavigationIconKey } from "@/lib/navigation";

const icons: Record<NavigationIconKey, LucideIcon> = {
  admin: Settings,
  app: PawPrint,
  bell: Bell,
  cart: ShoppingCart,
  catalog: ShoppingBag,
  customers: UsersRound,
  dashboard: LayoutDashboard,
  delivery: Truck,
  dog: Dog,
  help: CircleHelp,
  home: Home,
  location: MapPinned,
  orders: ClipboardList,
  profile: UserRound,
  promo: BadgePercent,
  security: ShieldCheck,
  search: Search,
  stock: Boxes,
  subscriptions: PackageSearch,
  support: BriefcaseBusiness,
  taxes: ReceiptText,
};

type Props = {
  name: NavigationIconKey;
  className?: string;
  size?: number;
};

export function NavIcon({ name, className, size = 18 }: Props) {
  const Icon = icons[name] ?? LockKeyhole;
  return <Icon aria-hidden="true" className={className} size={size} strokeWidth={2.25} />;
}
