import React, { useId, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ContactListOption {
  id: string;
  name: string;
}

interface ContactListPickerProps {
  options: ContactListOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function ContactListPicker({
  options,
  value,
  onChange,
  placeholder = 'Add a custom list and press Enter',
  disabled = false,
}: ContactListPickerProps) {
  const datalistId = useId();
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredOptions = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    return options.filter((option) => {
      if (value.includes(option.name)) return false;
      if (!query) return true;
      return option.name.toLowerCase().includes(query);
    }).slice(0, 6);
  }, [inputValue, options, value]);

  const addListName = (rawName: string) => {
    const normalized = rawName.trim();
    if (!normalized) return;

    const existing = value.some((item) => item.toLowerCase() === normalized.toLowerCase());
    if (!existing) {
      onChange([...value, normalized]);
    }
    setInputValue('');
  };

  const removeListName = (name: string) => {
    onChange(value.filter((item) => item !== name));
  };

  return (
    <div className="space-y-2">
      <div className="flex min-h-[48px] flex-wrap items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-slate-800">
        {value.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-700"
          >
            {name}
            {!disabled && (
              <button type="button" onClick={() => removeListName(name)} className="text-sky-500 transition hover:text-sky-700">
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        <input
          type="text"
          list={datalistId}
          value={inputValue}
          disabled={disabled}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addListName(inputValue);
            }
          }}
          placeholder={placeholder}
          className="min-w-[180px] flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-200"
        />
        <datalist id={datalistId}>
          {options
            .filter((option) => !value.some((item) => item.toLowerCase() === option.name.toLowerCase()))
            .map((option) => (
              <option key={option.id} value={option.name} />
            ))}
        </datalist>
      </div>

      {showSuggestions && filteredOptions.length > 0 && !disabled && (
        <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Existing Lists
          </div>
          {filteredOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addListName(option.name)}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors",
                "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-slate-800"
              )}
            >
              <span>{option.name}</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400">Use</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
