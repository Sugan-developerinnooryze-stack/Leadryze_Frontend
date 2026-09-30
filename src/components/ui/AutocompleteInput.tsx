import { useState, useRef, useEffect } from 'react';

interface AutocompleteInputProps<T> {
  value: string;
  onChange: (val: string) => void;
  options: T[];
  displayKey: keyof T;
  onSelect: (item: T) => void;
  placeholder?: string;
  className?: string;
}

export default function AutocompleteInput<T>({
  value,
  onChange,
  options,
  displayKey,
  onSelect,
  placeholder,
  className,
}: AutocompleteInputProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(option => {
    const text = String(option[displayKey] || '').toLowerCase();
    return text.includes((value || '').toLowerCase());
  });

  return (
    <div className="relative w-full" ref={containerRef}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {isOpen && filteredOptions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-surface border border-border rounded-md shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] scrollbar-thin scrollbar-thumb-border">
          {filteredOptions.map((option, idx) => (
            <li
              key={idx}
              className="px-3 py-2 text-xs font-medium text-text-primary hover:bg-ryze-50 dark:hover:bg-ryze-900/20 hover:text-ryze-700 dark:hover:text-ryze-400 cursor-pointer border-b border-border last:border-0 transition-colors"
              onMouseDown={(e) => {
                // Use onMouseDown instead of onClick to prevent input blur from firing before this
                e.preventDefault();
                onSelect(option);
                setIsOpen(false);
              }}
            >
              {String(option[displayKey] || '')}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
