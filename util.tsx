export function numFormatter(num: number, digits: number) {
  if (num < 1000) {
    return num.toPrecision(3);
  }
  const lookup = [
    { value: 1, symbol: "" },
    { value: 1e3, symbol: "k" },
    { value: 1e6, symbol: "M" },
    { value: 1e9, symbol: "B" },
    { value: 1e12, symbol: "T" },
    { value: 1e15, symbol: "P" },
    { value: 1e18, symbol: "E" },
  ];
  const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
  var item = lookup
    .slice()
    .reverse()
    .find(function (item) {
      return num >= item.value;
    });

  if (!digits) {
    digits = 2;
  }
  return item
    ? (num / item.value).toFixed(digits).replace(rx, "$1") + item.symbol
    : "0";
}

export function roundToSignificantDigits(
  num: number,
  significantDigits: number = 5
): number {
  if (num === 0) return 0;

  const digits = Math.floor(Math.log10(Math.abs(num))) + 1;
  const factor = Math.pow(10, significantDigits - digits);

  return Math.round(num * factor) / factor;
}
