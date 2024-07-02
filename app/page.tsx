"use client";
import React, { useState, useEffect, useRef, useReducer } from "react";
import { AxisData } from "./ScatterPlot";

import axios from "axios";
import ScatterPlot from "./ScatterPlot";
import SymbolSearch from "./SymbolSearch";
import { roundToSignificantDigits } from "@/util";

const apiKey = "HIQXUK3H0JU444C2";
const fetchQuote = async (symbol: string) => {
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;

  try {
    const response = await axios.get(url);
    return parseFloat(response.data["Global Quote"]["05. price"]);
  } catch (error) {
    console.error("Error fetching option chain data:", error);
    return null;
  }
};

interface OptionsMetrics {
  intrinsicValue: number;
  extrinsicValue: number;
  markPrice: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

// Type alias for the inner dictionary
type StrikePriceMap = Record<string, OptionsMetrics>;

// Type alias for the outer dictionary
type ExpiryMap = Record<string, StrikePriceMap>;

interface OptionsData {
  currentPrice: number;
  callOptions: ExpiryMap;
  putOptions: ExpiryMap;
}

// Pages
// ------------------------------------------------

export default function Page() {
  const [symbol, setSymbol] = useState("NVDA");
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [optionType, setOptionType] = useState("put");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [fromStrikePrice, setFromStrikePrice] = useState<number | null>(null);
  const [toStrikePrice, setToStrikePrice] = useState<number | null>(null);
  const [targetMetric, setTargetMetric] = useState("extrinsicValue");
  const [plotData, setPlotData] = useState<AxisData | undefined>(undefined);
  const [rawData, setRawData] = useState<OptionsData | undefined>(undefined);

  // ** FETCH CURRENT PRICE
  useEffect(() => {
    const fetchCurrentQuote = async () => {
      const price = await fetchQuote(symbol);
      if (price) {
        setCurrentPrice(price);
      }
    };
    fetchCurrentQuote();
  }, [symbol]);

  // ** FETCH OPTIONS CHAIN
  useEffect(() => {
    const fetchData = async () => {
      if (!currentPrice) return;
      const data = await fetchOptionPremiums(symbol, currentPrice);

      setRawData(data);
    };

    fetchData();
  }, [symbol, currentPrice]);

  // ** SET RELEVANT DEFAULTS
  useEffect(() => {
    if (currentPrice) {
      const today = new Date();
      const oneWeekFromNow = new Date(
        today.getTime() + 7 * 24 * 60 * 60 * 1000
      );
      const sixWeeksFromNow = new Date(
        today.getTime() + 42 * 24 * 60 * 60 * 1000
      );

      setStartDate(oneWeekFromNow.toISOString().split("T")[0]);
      setEndDate(sixWeeksFromNow.toISOString().split("T")[0]);

      const lowerBound = Math.round(currentPrice * 0.75);
      const upperBound = Math.round(currentPrice * 1.25);

      setFromStrikePrice(lowerBound);
      setToStrikePrice(upperBound);
    }
  }, [currentPrice]);

  // ** FILTER OUT DATA
  useEffect(() => {
    if (!rawData) return;
    let filteredData = filterData({
      data: rawData,
      optionType,
      startDate,
      endDate,
      fromStrikePrice,
      toStrikePrice,
    });

    setPlotData(mungeData(filteredData, targetMetric as any));
  }, [
    rawData,
    optionType,
    targetMetric,
    startDate,
    endDate,
    fromStrikePrice,
    toStrikePrice,
  ]);

  const handleSymbolSelect = (newSymbol: string) => {
    setSymbol(newSymbol);
    setCurrentPrice(null); // Reset currentPrice when a new symbol is selected
  };

  if (!plotData || currentPrice === null) return null;

  console.log("plotDat", plotData);
  console.log("currentPrice", currentPrice);

  return (
    <div className="flex flex-col h-screen">
      <div className="p-4">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <SymbolSearch
            initialValue={symbol}
            onSymbolSelect={handleSymbolSelect}
          />

          <CustomSelect
            value={optionType}
            onChange={setOptionType}
            options={[
              { value: "call", label: "Call" },
              { value: "put", label: "Put" },
            ]}
          />
          <CustomSelect
            value={targetMetric}
            onChange={setTargetMetric}
            options={[
              { value: "markPrice", label: "Mark Price" },
              { value: "intrinsicValue", label: "Intrinsic Value" },
              { value: "extrinsicValue", label: "Extrinsic Value" },
              { value: "delta", label: "Delta" },
              { value: "gamma", label: "Gamma" },
              { value: "theta", label: "Theta" },
              { value: "vega", label: "Vega" },
              { value: "rho", label: "Rho" },
            ]}
          />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <input
            type="number"
            value={fromStrikePrice || ""}
            onChange={(e) => setFromStrikePrice(parseFloat(e.target.value))}
            placeholder="From Strike Price"
          />
          <input
            type="number"
            value={toStrikePrice || ""}
            onChange={(e) => setToStrikePrice(parseFloat(e.target.value))}
            placeholder="To Strike Price"
          />
        </div>
      </div>
      <div className="flex-grow">
        {plotData && (
          <ScatterPlot
            optionType={optionType}
            currentPrice={roundToSignificantDigits(currentPrice!, 5)}
            data={plotData}
          />
        )}
      </div>
    </div>
  );
}

async function fetchOptionPremiums(
  symbol: string,
  currentPrice: number
): Promise<OptionsData> {
  const url = `https://www.alphavantage.co/query?function=HISTORICAL_OPTIONS&symbol=${symbol}&apikey=${apiKey}`;

  try {
    const response = await axios.get(url);
    const data = response.data.data;

    // Create maps to store the results for call and put options
    const callOptions: ExpiryMap = {};
    const putOptions: ExpiryMap = {};

    data.forEach((option: any) => {
      const expiration = option.expiration;
      const strikePrice = parseFloat(option.strike).toFixed(2);
      const markPrice = parseFloat(option.mark);
      const delta = parseFloat(option.delta);
      const gamma = parseFloat(option.gamma);
      const theta = parseFloat(option.theta);
      const vega = parseFloat(option.vega);
      const rho = parseFloat(option.rho);

      let intrinsicValue = 0;
      if (option.type === "call") {
        intrinsicValue = Math.max(0, currentPrice - parseFloat(option.strike));
      } else if (option.type === "put") {
        intrinsicValue = Math.max(0, parseFloat(option.strike) - currentPrice);
      }

      const extrinsicValue = markPrice - intrinsicValue;

      const metrics: OptionsMetrics = {
        intrinsicValue,
        extrinsicValue,
        markPrice,
        delta,
        gamma,
        theta,
        vega,
        rho,
      };

      // Determine whether it's a call or put option and add to the appropriate map
      if (option.type === "call") {
        if (!callOptions[expiration]) {
          callOptions[expiration] = {};
        }
        callOptions[expiration][strikePrice] = metrics;
      } else if (option.type === "put") {
        if (!putOptions[expiration]) {
          putOptions[expiration] = {};
        }
        putOptions[expiration][strikePrice] = metrics;
      }
    });

    return { callOptions, putOptions, currentPrice };
  } catch (error) {
    console.error("Error fetching option premiums:", error);
    throw error;
  }
}

function mungeData(
  input: ExpiryMap,
  targetMetric: keyof OptionsMetrics
): AxisData {
  let output: AxisData = {
    x: { data: [], name: "Days Til Expiration" },
    y: { data: [], name: "Strike Price" },
    z: { data: [], name: targetMetric },
  };

  const today = new Date();
  const sortedExpiries = Object.keys(input).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  for (const expiry of sortedExpiries) {
    const expiryDate = new Date(expiry);
    const daysTilExpiration = Math.ceil(
      (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    const strikes = Object.keys(input[expiry]).sort(
      (a, b) => parseFloat(a) - parseFloat(b)
    );

    for (const strike of strikes) {
      const strikePrice = parseFloat(strike);
      const metricValue = input[expiry][strike][targetMetric];

      output.x.data.push(daysTilExpiration);
      output.y.data.push(strikePrice);
      output.z.data.push(metricValue);
    }
  }

  return output;
}
function filterData({
  data,
  optionType,
  startDate,
  endDate,
  fromStrikePrice,
  toStrikePrice,
}: any) {
  const filteredOptions: ExpiryMap = {};
  const targetOptions =
    optionType === "call" ? data.callOptions : data.putOptions;

  const startDateTime = new Date(startDate).getTime();
  const endDateTime = new Date(endDate).getTime();

  for (const expiry in targetOptions) {
    const expiryDate = new Date(expiry).getTime();
    if (expiryDate >= startDateTime && expiryDate <= endDateTime) {
      for (const strike in targetOptions[expiry]) {
        if (
          parseFloat(strike) >= parseFloat(fromStrikePrice) &&
          parseFloat(strike) <= parseFloat(toStrikePrice)
        ) {
          if (!filteredOptions[expiry]) {
            filteredOptions[expiry] = {};
          }
          filteredOptions[expiry][strike] = targetOptions[expiry][strike];
        }
      }
    }
  }
  return filteredOptions;
}

const CustomSelect = ({ value, onChange, options }: any) => (
  <select value={value} onChange={(e) => onChange(e.target.value)}>
    {options.map((option: any) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);
