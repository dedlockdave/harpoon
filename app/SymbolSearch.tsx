import React, { useState, useCallback, useEffect } from "react";
import axios from "axios";
import AsyncSelect from "react-select/async";
import debounce from "lodash/debounce";

const API_KEY = "HIQXUK3H0JU444C2"; // Replace with your Alpha Vantage API key

interface SymbolOption {
  value: string;
  label: string;
}

interface SymbolSearchProps {
  onSymbolSelect: (symbol: string) => void;
  initialValue: string;
}

const SymbolSearch: React.FC<SymbolSearchProps> = ({
  onSymbolSelect,
  initialValue,
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState<SymbolOption | null>(
    null
  );
  const [inputValue, setInputValue] = useState(initialValue || "");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [tempInputValue, setTempInputValue] = useState(initialValue || "");

  useEffect(() => {
    setInputValue(initialValue);
    setTempInputValue(initialValue);
  }, [initialValue]);

  const fetchSymbols = async (input: string): Promise<SymbolOption[]> => {
    if (input.length < 1) {
      return [];
    }

    try {
      const response = await axios.get("https://www.alphavantage.co/query", {
        params: {
          function: "SYMBOL_SEARCH",
          keywords: input,
          apikey: API_KEY,
        },
      });

      if (response.data.Note) {
        console.warn("API call frequency warning:", response.data.Note);
        return [];
      }

      if (!response.data.bestMatches) {
        console.error("Unexpected API response:", response.data);
        return [];
      }

      return response.data.bestMatches.map((match: any) => ({
        value: match["1. symbol"],
        label: `${match["1. symbol"]} - ${match["2. name"]}`,
      }));
    } catch (error) {
      console.error("Error fetching symbols:", error);
      return [];
    }
  };

  const debouncedFetchSymbols = useCallback(
    debounce((input: string, callback: (options: SymbolOption[]) => void) => {
      fetchSymbols(input).then(callback);
    }, 300),
    []
  );

  const loadOptions = (
    input: string,
    callback: (options: SymbolOption[]) => void
  ) => {
    debouncedFetchSymbols(input, callback);
  };

  const handleInputChange = (
    newValue: string,
    { action }: { action: string }
  ) => {
    if (action === "input-change") {
      setTempInputValue(newValue);
    }
  };

  const handleSymbolChange = (option: SymbolOption | null) => {
    setSelectedSymbol(option);
    if (option) {
      onSymbolSelect(option.value);
      setInputValue(option.value);
      setTempInputValue(option.value);
    }
  };

  const handleMenuOpen = () => {
    setIsMenuOpen(true);
    setTempInputValue("");
  };

  const handleMenuClose = () => {
    setIsMenuOpen(false);
    if (!tempInputValue) {
      setTempInputValue(inputValue);
    } else {
      setInputValue(tempInputValue);
    }
  };

  return (
    <AsyncSelect
      cacheOptions
      loadOptions={loadOptions}
      onInputChange={handleInputChange}
      onChange={handleSymbolChange}
      onMenuOpen={handleMenuOpen}
      onMenuClose={handleMenuClose}
      value={selectedSymbol}
      inputValue={isMenuOpen ? tempInputValue : inputValue}
      placeholder="Search for a symbol..."
      loadingMessage={() => "Searching..."}
      noOptionsMessage={({ inputValue }) =>
        inputValue.length > 0 ? "No symbols found" : "Start typing to search"
      }
    />
  );
};

export default SymbolSearch;
