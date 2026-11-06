import React from 'react';

export const Input = ({
  label,
  id,
  type = 'text',
  placeholder = '',
  value,
  onChange,
  error,
  helperText,
  required = false,
  disabled = false,
  icon: Icon,
  endIcon,
  className = '',
  ...props
}) => {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
        >
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}
      <div className="relative rounded-lg shadow-sm">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`block w-full rounded-lg bg-slate-900 border text-slate-100 placeholder-slate-500 text-sm py-2.5 transition-colors focus:outline-none focus:ring-2 ${
            Icon ? 'pl-10' : 'pl-3.5'
          } ${endIcon ? 'pr-10' : 'pr-3.5'} ${
            error
              ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20'
              : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
          } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-950' : ''}`}
          {...props}
        />
        {endIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {endIcon}
          </div>
        )}
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-red-400 font-medium">{error}</p>
      ) : helperText ? (
        <p className="mt-1.5 text-xs text-slate-500">{helperText}</p>
      ) : null}
    </div>
  );
};

export default Input;

