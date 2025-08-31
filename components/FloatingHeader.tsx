import { Button } from "./ui/button";
import React from "react";

interface FloatingHeaderProps {
  isScrolled: boolean;
  onStylizeClick: () => void;
}

export function FloatingHeader({ isScrolled, onStylizeClick }: FloatingHeaderProps) {
  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-50 p-2 transition-all duration-300 ${
        isScrolled ? 'bg-background/75 backdrop-blur-lg shadow-lg rounded-sm border border-border/50 mx-8 mt-8' : 'bg-transparent'
      }`}
    >
      <div className="w-full flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Styllio</h1>
        <div className="flex items-center space-x-2">
          <Button 
            className="rounded-sm"
            onClick={onStylizeClick}
          >
            Stylize your image - from{' '}
            <span className="text-sm">$2.50</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
