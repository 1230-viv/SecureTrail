import React, { createContext, useContext, useState } from 'react';

const SidebarContext = createContext({ collapsed: false, setCollapsed: () => {} });

export const SidebarProvider = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => useContext(SidebarContext);
