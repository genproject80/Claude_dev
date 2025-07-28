import { Home, BarChart3, Settings, Users } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const allItems = [
  { title: "Dashboard", url: "/", icon: Home, requiredRole: null },
  { title: "Reports", url: "/reports", icon: BarChart3, requiredRole: null },
  { title: "Admin", url: "/admin", icon: Settings, requiredRole: "admin" },
  { title: "Users", url: "/users", icon: Users, requiredRole: "admin" },
];

export function AppSidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;

  // Filter items based on user role
  const items = allItems.filter(item => {
    if (!item.requiredRole) return true; // Show to everyone
    if (!user) return false; // Hide if no user
    return user.role === item.requiredRole; // Show only if user has required role
  });

  return (
    <Sidebar>
      <SidebarContent className="bg-card border-r">
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground px-3 py-2">
            Navigation
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end>
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}