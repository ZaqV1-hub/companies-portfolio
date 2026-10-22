// Common investor countries have a state/province selector. Other countries use a text field.
const entries = {
  BR: `AC|Acre;AL|Alagoas;AP|Amapá;AM|Amazonas;BA|Bahia;CE|Ceará;DF|Distrito Federal;ES|Espírito Santo;GO|Goiás;MA|Maranhão;MT|Mato Grosso;MS|Mato Grosso do Sul;MG|Minas Gerais;PA|Pará;PB|Paraíba;PR|Paraná;PE|Pernambuco;PI|Piauí;RJ|Rio de Janeiro;RN|Rio Grande do Norte;RS|Rio Grande do Sul;RO|Rondônia;RR|Roraima;SC|Santa Catarina;SP|São Paulo;SE|Sergipe;TO|Tocantins`,
  US: `AL|Alabama;AK|Alaska;AZ|Arizona;AR|Arkansas;CA|California;CO|Colorado;CT|Connecticut;DE|Delaware;DC|District of Columbia;FL|Florida;GA|Georgia;HI|Hawaii;ID|Idaho;IL|Illinois;IN|Indiana;IA|Iowa;KS|Kansas;KY|Kentucky;LA|Louisiana;ME|Maine;MD|Maryland;MA|Massachusetts;MI|Michigan;MN|Minnesota;MS|Mississippi;MO|Missouri;MT|Montana;NE|Nebraska;NV|Nevada;NH|New Hampshire;NJ|New Jersey;NM|New Mexico;NY|New York;NC|North Carolina;ND|North Dakota;OH|Ohio;OK|Oklahoma;OR|Oregon;PA|Pennsylvania;RI|Rhode Island;SC|South Carolina;SD|South Dakota;TN|Tennessee;TX|Texas;UT|Utah;VT|Vermont;VA|Virginia;WA|Washington;WV|West Virginia;WI|Wisconsin;WY|Wyoming`,
  CA: `AB|Alberta;BC|British Columbia;MB|Manitoba;NB|New Brunswick;NL|Newfoundland and Labrador;NS|Nova Scotia;NT|Northwest Territories;NU|Nunavut;ON|Ontario;PE|Prince Edward Island;QC|Québec;SK|Saskatchewan;YT|Yukon`,
  AU: `ACT|Australian Capital Territory;NSW|New South Wales;NT|Northern Territory;QLD|Queensland;SA|South Australia;TAS|Tasmania;VIC|Victoria;WA|Western Australia`,
};

export function stateOptions(country) {
  return entries[country]?.split(';').map((entry) => {
    const [code, name] = entry.split('|');
    return { code, name };
  }) || null;
}
