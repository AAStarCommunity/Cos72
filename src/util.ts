import numbro from "numbro";
export const toSignificant = (num: any, digits = 3) => {
    if (num == 0) return "0";
    if (!num) return "-";
  
    if (num < 0.001) {
      return "<0.001";
    }
    // if (num < 0.01) {
    //   return "<0.01";
    // }
    return numbro(num)
      .format({
        average: true,
        mantissa: num > 1000 ? 2 : digits,
        abbreviations: {
          million: "M",
          billion: "B",
        },
      })
      .toUpperCase();
  };