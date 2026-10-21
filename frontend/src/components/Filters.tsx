import React from "react";
import { Button } from "./Button";
import { Input, Select, Checkbox } from "./Input";

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterGroup {
  name: string;
  label: string;
  type: "select" | "checkbox" | "range";
  options?: FilterOption[];
  min?: number;
  max?: number;
}

interface FiltersProps {
  filters: FilterGroup[];
  onApply: (filters: Record<string, any>) => void;
  onReset: () => void;
  className?: string;
}

export const Filters: React.FC<FiltersProps> = ({
  filters,
  onApply,
  onReset,
  className = "",
}) => {
  const [selectedFilters, setSelectedFilters] = React.useState<Record<string, any>>({});

  const handleFilterChange = (name: string, value: any) => {
    setSelectedFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleApply = () => {
    onApply(selectedFilters);
  };

  const handleReset = () => {
    setSelectedFilters({});
    onReset();
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <h3 className="text-lg font-semibold mb-4">Фильтры</h3>

      <div className="space-y-4">
        {filters.map((filter) => (
          <div key={filter.name}>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              {filter.label}
            </label>

            {filter.type === "select" && filter.options && (
              <Select
                name={filter.name}
                options={filter.options}
                onChange={(e) => handleFilterChange(filter.name, e.target.value)}
                fullWidth
              />
            )}

            {filter.type === "checkbox" && filter.options && (
              <div className="space-y-2">
                {filter.options.map((option) => (
                  <Checkbox
                    key={option.value}
                    name={`${filter.name}_${option.value}`}
                    label={`${option.label} ${option.count ? `(${option.count})` : ""}`}
                    onChange={(e) => {
                      const currentValues = selectedFilters[filter.name] || [];
                      if (e.target.checked) {
                        handleFilterChange(filter.name, [...currentValues, option.value]);
                      } else {
                        handleFilterChange(
                          filter.name,
                          currentValues.filter((v: string) => v !== option.value)
                        );
                      }
                    }}
                  />
                ))}
              </div>
            )}

            {filter.type === "range" && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder={filter.min?.toString()}
                  onChange={(e) =>
                    handleFilterChange(`${filter.name}_min`, e.target.value)
                  }
                />
                <span>—</span>
                <Input
                  type="number"
                  placeholder={filter.max?.toString()}
                  onChange={(e) =>
                    handleFilterChange(`${filter.name}_max`, e.target.value)
                  }
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-6">
        <Button variant="primary" fullWidth onClick={handleApply}>
          Применить
        </Button>
        <Button variant="secondary" fullWidth onClick={handleReset}>
          Сбросить
        </Button>
      </div>
    </div>
  );
};
