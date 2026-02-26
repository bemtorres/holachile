/**
 * enrich-comunas.mjs
 * Genera src/data/comunas-metropolitanas.json enriquecido con:
 *   cut, lat, lng, población, dirección municipal, url_municipal,
 *   wiki_url, logo_url (Wikipedia Wikidata CDN)
 *
 * Fuentes:
 *   CUT: INE Chile (Código Único Territorial)
 *   Coords: centroides comunales aproximados
 *   Población: Censo 2017 INE / proyecciones 2023
 *   Municipios: datos oficiales
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ──────────────────────────────────────────────────────────────────────────────
//  DATOS ENRIQUECIDOS – 52 comunas de la Región Metropolitana
// ──────────────────────────────────────────────────────────────────────────────
const COMUNAS = [
  // ── Provincia de Santiago ─────────────────────────────────────────────────
  {
    comuna: "Cerrillos",
    provincia: "Provincia de Santiago",
    cut: "13102",
    lat: -33.4882, lng: -70.7133,
    poblacion: 85285,
    direccion_municipal: "Av. Pedro Aguirre Cerda 9100, Cerrillos",
    url_municipal: "https://www.cerrillos.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Cerrillos",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Escudo_de_Cerrillos.svg/200px-Escudo_de_Cerrillos.svg.png"
  },
  {
    comuna: "Cerro Navia",
    provincia: "Provincia de Santiago",
    cut: "13103",
    lat: -33.4220, lng: -70.7340,
    poblacion: 148312,
    direccion_municipal: "Av. Pedro Aguirre Cerda 7530, Cerro Navia",
    url_municipal: "https://www.cerronavia.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Cerro_Navia",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Escudo_de_Cerro_Navia.svg/200px-Escudo_de_Cerro_Navia.svg.png"
  },
  {
    comuna: "Conchalí",
    provincia: "Provincia de Santiago",
    cut: "13104",
    lat: -33.3845, lng: -70.6610,
    poblacion: 133256,
    direccion_municipal: "Av. Independencia 5860, Conchalí",
    url_municipal: "https://www.conchali.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Conchal%C3%AD",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Escudo_de_Conchal%C3%AD.svg/200px-Escudo_de_Conchal%C3%AD.svg.png"
  },
  {
    comuna: "El Bosque",
    provincia: "Provincia de Santiago",
    cut: "13105",
    lat: -33.5660, lng: -70.6740,
    poblacion: 177023,
    direccion_municipal: "Av. Concha y Toro 2901, El Bosque",
    url_municipal: "https://www.municipioelbosque.cl",
    wiki_url: "https://es.wikipedia.org/wiki/El_Bosque_(Chile)",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Escudo_El_Bosque.svg/200px-Escudo_El_Bosque.svg.png"
  },
  {
    comuna: "Estación Central",
    provincia: "Provincia de Santiago",
    cut: "13106",
    lat: -33.4524, lng: -70.6778,
    poblacion: 147623,
    direccion_municipal: "Av. Ecuador 3485, Estación Central",
    url_municipal: "https://www.estacioncentral.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Estaci%C3%B3n_Central_(Chile)",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Escudo_de_Estaci%C3%B3n_Central.svg/200px-Escudo_de_Estaci%C3%B3n_Central.svg.png"
  },
  {
    comuna: "Huechuraba",
    provincia: "Provincia de Santiago",
    cut: "13107",
    lat: -33.3580, lng: -70.6440,
    poblacion: 98603,
    direccion_municipal: "Av. Recoleta 7255, Huechuraba",
    url_municipal: "https://www.huechuraba.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Huechuraba",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Escudo_de_Huechuraba.svg/200px-Escudo_de_Huechuraba.svg.png"
  },
  {
    comuna: "Independencia",
    provincia: "Provincia de Santiago",
    cut: "13108",
    lat: -33.4186, lng: -70.6560,
    poblacion: 113001,
    direccion_municipal: "Av. Independencia 1600, Independencia",
    url_municipal: "https://www.munistgoindependencia.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Independencia_(Chile)",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Escudo_de_Independencia.svg/200px-Escudo_de_Independencia.svg.png"
  },
  {
    comuna: "La Cisterna",
    provincia: "Provincia de Santiago",
    cut: "13109",
    lat: -33.5245, lng: -70.6620,
    poblacion: 94236,
    direccion_municipal: "Av. Pedro Aguirre Cerda 4590, La Cisterna",
    url_municipal: "https://www.lacisterna.cl",
    wiki_url: "https://es.wikipedia.org/wiki/La_Cisterna",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Escudo_La_Cisterna.svg/200px-Escudo_La_Cisterna.svg.png"
  },
  {
    comuna: "La Florida",
    provincia: "Provincia de Santiago",
    cut: "13110",
    lat: -33.5240, lng: -70.5897,
    poblacion: 366916,
    direccion_municipal: "Av. Vicuña Mackenna 7110, La Florida",
    url_municipal: "https://www.laflorida.cl",
    wiki_url: "https://es.wikipedia.org/wiki/La_Florida_(Chile)",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Escudo_de_La_Florida.svg/200px-Escudo_de_La_Florida.svg.png"
  },
  {
    comuna: "La Granja",
    provincia: "Provincia de Santiago",
    cut: "13111",
    lat: -33.5310, lng: -70.6380,
    poblacion: 132681,
    direccion_municipal: "Av. Pedro Aguirre Cerda 6226, La Granja",
    url_municipal: "https://www.municipiolagranja.cl",
    wiki_url: "https://es.wikipedia.org/wiki/La_Granja_(Chile)",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Escudo_de_La_Granja.svg/200px-Escudo_de_La_Granja.svg.png"
  },
  {
    comuna: "La Pintana",
    provincia: "Provincia de Santiago",
    cut: "13112",
    lat: -33.5820, lng: -70.6300,
    poblacion: 190085,
    direccion_municipal: "Av. Gabriela Oriente 4001, La Pintana",
    url_municipal: "https://www.lapintana.cl",
    wiki_url: "https://es.wikipedia.org/wiki/La_Pintana",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Escudo_de_La_Pintana.svg/200px-Escudo_de_La_Pintana.svg.png"
  },
  {
    comuna: "La Reina",
    provincia: "Provincia de Santiago",
    cut: "13113",
    lat: -33.4471, lng: -70.5363,
    poblacion: 93763,
    direccion_municipal: "Av. Ossa 735, La Reina",
    url_municipal: "https://www.lareina.cl",
    wiki_url: "https://es.wikipedia.org/wiki/La_Reina",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Escudo_La_Reina.svg/200px-Escudo_La_Reina.svg.png"
  },
  {
    comuna: "Las Condes",
    provincia: "Provincia de Santiago",
    cut: "13114",
    lat: -33.4170, lng: -70.5563,
    poblacion: 294838,
    direccion_municipal: "Av. Apoquindo 3458, Las Condes",
    url_municipal: "https://www.lascondes.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Las_Condes",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Escudo_de_Las_Condes.svg/200px-Escudo_de_Las_Condes.svg.png"
  },
  {
    comuna: "Lo Barnechea",
    provincia: "Provincia de Santiago",
    cut: "13115",
    lat: -33.3503, lng: -70.5156,
    poblacion: 105833,
    direccion_municipal: "Av. Los Militares 6210, Lo Barnechea",
    url_municipal: "https://www.lobarnechea.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Lo_Barnechea",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Escudo_de_Lo_Barnechea.svg/200px-Escudo_de_Lo_Barnechea.svg.png"
  },
  {
    comuna: "Lo Espejo",
    provincia: "Provincia de Santiago",
    cut: "13116",
    lat: -33.5135, lng: -70.7033,
    poblacion: 107669,
    direccion_municipal: "Av. Lo Espejo 1870, Lo Espejo",
    url_municipal: "https://www.loespejo.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Lo_Espejo",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Escudo_de_Lo_Espejo.svg/200px-Escudo_de_Lo_Espejo.svg.png"
  },
  {
    comuna: "Lo Prado",
    provincia: "Provincia de Santiago",
    cut: "13117",
    lat: -33.4425, lng: -70.7220,
    poblacion: 105233,
    direccion_municipal: "Av. Lo Prado 3561, Lo Prado",
    url_municipal: "https://www.loprado.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Lo_Prado",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Escudo_de_Lo_Prado.svg/200px-Escudo_de_Lo_Prado.svg.png"
  },
  {
    comuna: "Macul",
    provincia: "Provincia de Santiago",
    cut: "13118",
    lat: -33.4860, lng: -70.6020,
    poblacion: 118370,
    direccion_municipal: "Av. Departamental 1050, Macul",
    url_municipal: "https://www.macul.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Macul",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Escudo_de_Macul.svg/200px-Escudo_de_Macul.svg.png"
  },
  {
    comuna: "Maipú",
    provincia: "Provincia de Santiago",
    cut: "13119",
    lat: -33.5120, lng: -70.7640,
    poblacion: 521627,
    direccion_municipal: "Av. 5 de Abril 190, Maipú",
    url_municipal: "https://www.maipu.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Maip%C3%BA",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Escudo_de_Maip%C3%BA.svg/200px-Escudo_de_Maip%C3%BA.svg.png"
  },
  {
    comuna: "Ñuñoa",
    provincia: "Provincia de Santiago",
    cut: "13120",
    lat: -33.4570, lng: -70.5983,
    poblacion: 209003,
    direccion_municipal: "Av. Irarrázaval 4964, Ñuñoa",
    url_municipal: "https://www.nunoa.cl",
    wiki_url: "https://es.wikipedia.org/wiki/%C3%91u%C3%B1oa",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Escudo_de_%C3%91u%C3%B1oa.svg/200px-Escudo_de_%C3%91u%C3%B1oa.svg.png"
  },
  {
    comuna: "Pedro Aguirre Cerda",
    provincia: "Provincia de Santiago",
    cut: "13121",
    lat: -33.4920, lng: -70.6720,
    poblacion: 114673,
    direccion_municipal: "Av. José Joaquín Pérez 6030, Pedro Aguirre Cerda",
    url_municipal: "https://www.pac.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Pedro_Aguirre_Cerda",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Escudo_de_Pedro_Aguirre_Cerda.svg/200px-Escudo_de_Pedro_Aguirre_Cerda.svg.png"
  },
  {
    comuna: "Peñalolén",
    provincia: "Provincia de Santiago",
    cut: "13122",
    lat: -33.4845, lng: -70.5373,
    poblacion: 241910,
    direccion_municipal: "Av. Tobalaba 12.511, Peñalolén",
    url_municipal: "https://www.penalolen.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Pe%C3%B1alol%C3%A9n",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Escudo_de_Pe%C3%B1alol%C3%A9n.svg/200px-Escudo_de_Pe%C3%B1alol%C3%A9n.svg.png"
  },
  {
    comuna: "Providencia",
    provincia: "Provincia de Santiago",
    cut: "13123",
    lat: -33.4338, lng: -70.6111,
    poblacion: 142079,
    direccion_municipal: "Av. 11 de Septiembre 1542, Providencia",
    url_municipal: "https://www.providencia.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Providencia_(Chile)",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Escudo_de_Providencia.svg/200px-Escudo_de_Providencia.svg.png"
  },
  {
    comuna: "Pudahuel",
    provincia: "Provincia de Santiago",
    cut: "13124",
    lat: -33.4339, lng: -70.7644,
    poblacion: 233467,
    direccion_municipal: "Av. Félix Fontecilla 420, Pudahuel",
    url_municipal: "https://www.pudahuel.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Pudahuel",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Escudo_de_Pudahuel.svg/200px-Escudo_de_Pudahuel.svg.png"
  },
  {
    comuna: "Quilicura",
    provincia: "Provincia de Santiago",
    cut: "13125",
    lat: -33.3593, lng: -70.7280,
    poblacion: 219548,
    direccion_municipal: "Av. Manuel Antonio Matta 870, Quilicura",
    url_municipal: "https://www.quilicura.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Quilicura",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Escudo_de_Quilicura.svg/200px-Escudo_de_Quilicura.svg.png"
  },
  {
    comuna: "Quinta Normal",
    provincia: "Provincia de Santiago",
    cut: "13126",
    lat: -33.4400, lng: -70.7048,
    poblacion: 104012,
    direccion_municipal: "Av. Mapocho 4765, Quinta Normal",
    url_municipal: "https://www.quintanormal.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Quinta_Normal",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Escudo_de_Quinta_Normal.svg/200px-Escudo_de_Quinta_Normal.svg.png"
  },
  {
    comuna: "Recoleta",
    provincia: "Provincia de Santiago",
    cut: "13127",
    lat: -33.3975, lng: -70.6425,
    poblacion: 148220,
    direccion_municipal: "Av. Recoleta 2774, Recoleta",
    url_municipal: "https://www.recoleta.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Recoleta_(Chile)",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Escudo_de_Recoleta.svg/200px-Escudo_de_Recoleta.svg.png"
  },
  {
    comuna: "Renca",
    provincia: "Provincia de Santiago",
    cut: "13128",
    lat: -33.4005, lng: -70.7210,
    poblacion: 145670,
    direccion_municipal: "Av. Renca Norte 701, Renca",
    url_municipal: "https://www.renca.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Renca",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Escudo_de_Renca.svg/200px-Escudo_de_Renca.svg.png"
  },
  {
    comuna: "San Joaquín",
    provincia: "Provincia de Santiago",
    cut: "13129",
    lat: -33.4930, lng: -70.6265,
    poblacion: 103619,
    direccion_municipal: "Av. Departamental 1820, San Joaquín",
    url_municipal: "https://www.sanjoaquin.cl",
    wiki_url: "https://es.wikipedia.org/wiki/San_Joaqu%C3%ADn_(Chile)",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Escudo_de_San_Joaqu%C3%ADn.svg/200px-Escudo_de_San_Joaqu%C3%ADn.svg.png"
  },
  {
    comuna: "San Miguel",
    provincia: "Provincia de Santiago",
    cut: "13130",
    lat: -33.4975, lng: -70.6455,
    poblacion: 107697,
    direccion_municipal: "Av. Departamental 450, San Miguel",
    url_municipal: "https://www.sanmiguel.cl",
    wiki_url: "https://es.wikipedia.org/wiki/San_Miguel_(Chile)",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Escudo_de_San_Miguel.svg/200px-Escudo_de_San_Miguel.svg.png"
  },
  {
    comuna: "San Ramón",
    provincia: "Provincia de Santiago",
    cut: "13131",
    lat: -33.5380, lng: -70.6400,
    poblacion: 96756,
    direccion_municipal: "Av. La Serena 3337, San Ramón",
    url_municipal: "https://www.sanramon.cl",
    wiki_url: "https://es.wikipedia.org/wiki/San_Ram%C3%B3n_(Chile)",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Escudo_San_Ram%C3%B3n.svg/200px-Escudo_San_Ram%C3%B3n.svg.png"
  },
  {
    comuna: "Santiago",
    provincia: "Provincia de Santiago",
    cut: "13101",
    lat: -33.4569, lng: -70.6483,
    poblacion: 404495,
    direccion_municipal: "Plaza de Armas s/n, Santiago Centro",
    url_municipal: "https://www.santiago.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Santiago_de_Chile",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Escudo_de_Santiago_de_Chile.svg/200px-Escudo_de_Santiago_de_Chile.svg.png"
  },
  {
    comuna: "Vitacura",
    provincia: "Provincia de Santiago",
    cut: "13132",
    lat: -33.3917, lng: -70.5745,
    poblacion: 85384,
    direccion_municipal: "Av. Bicentenario 3500, Vitacura",
    url_municipal: "https://www.vitacura.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Vitacura",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Escudo_de_Vitacura.svg/200px-Escudo_de_Vitacura.svg.png"
  },

  // ── Provincia Cordillera ───────────────────────────────────────────────────
  {
    comuna: "Puente Alto",
    provincia: "Provincia Cordillera",
    cut: "13201",
    lat: -33.5756, lng: -70.5772,
    poblacion: 568106,
    direccion_municipal: "Av. Concha y Toro 590, Puente Alto",
    url_municipal: "https://www.puentealto.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Puente_Alto",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Escudo_de_Puente_Alto.svg/200px-Escudo_de_Puente_Alto.svg.png"
  },
  {
    comuna: "Pirque",
    provincia: "Provincia Cordillera",
    cut: "13202",
    lat: -33.6453, lng: -70.5560,
    poblacion: 17118,
    direccion_municipal: "Av. Concha y Toro s/n, Pirque",
    url_municipal: "https://www.pirque.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Pirque",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Escudo_de_Pirque.svg/200px-Escudo_de_Pirque.svg.png"
  },
  {
    comuna: "San José de Maipo",
    provincia: "Provincia Cordillera",
    cut: "13203",
    lat: -33.6423, lng: -70.3533,
    poblacion: 16684,
    direccion_municipal: "Calle Comercio 19530, San José de Maipo",
    url_municipal: "https://www.msjosedemaipo.cl",
    wiki_url: "https://es.wikipedia.org/wiki/San_Jos%C3%A9_de_Maipo",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Escudo_de_San_Jos%C3%A9_de_Maipo.svg/200px-Escudo_de_San_Jos%C3%A9_de_Maipo.svg.png"
  },

  // ── Provincia Maipo ────────────────────────────────────────────────────────
  {
    comuna: "San Bernardo",
    provincia: "Provincia Maipo",
    cut: "13401",
    lat: -33.5920, lng: -70.6990,
    poblacion: 246762,
    direccion_municipal: "Freire 270, San Bernardo",
    url_municipal: "https://www.sanbernardo.cl",
    wiki_url: "https://es.wikipedia.org/wiki/San_Bernardo_(Chile)",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Escudo_de_San_Bernardo.svg/200px-Escudo_de_San_Bernardo.svg.png"
  },
  {
    comuna: "Buin",
    provincia: "Provincia Maipo",
    cut: "13402",
    lat: -33.7347, lng: -70.7387,
    poblacion: 84649,
    direccion_municipal: "Manuel Rodríguez 550, Buin",
    url_municipal: "https://www.munibuin.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Buin_(Chile)",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Escudo_de_Buin.svg/200px-Escudo_de_Buin.svg.png"
  },
  {
    comuna: "Calera de Tango",
    provincia: "Provincia Maipo",
    cut: "13403",
    lat: -33.6347, lng: -70.7650,
    poblacion: 24972,
    direccion_municipal: "Camino a Calera de Tango 3150, Calera de Tango",
    url_municipal: "https://www.caleraodetango.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Calera_de_Tango",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Escudo_Calera_de_Tango.svg/200px-Escudo_Calera_de_Tango.svg.png"
  },
  {
    comuna: "Paine",
    provincia: "Provincia Maipo",
    cut: "13404",
    lat: -33.8090, lng: -70.7410,
    poblacion: 80869,
    direccion_municipal: "Manuel Rodríguez 350, Paine",
    url_municipal: "https://www.munipaine.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Paine",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Escudo_de_Paine.svg/200px-Escudo_de_Paine.svg.png"
  },

  // ── Provincia Talagante ────────────────────────────────────────────────────
  {
    comuna: "Talagante",
    provincia: "Provincia Talagante",
    cut: "13601",
    lat: -33.6647, lng: -70.9250,
    poblacion: 72977,
    direccion_municipal: "Ignacio Carrera Pinto 285, Talagante",
    url_municipal: "https://www.municipalidaddetalagante.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Talagante",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Escudo_de_Talagante.svg/200px-Escudo_de_Talagante.svg.png"
  },
  {
    comuna: "El Monte",
    provincia: "Provincia Talagante",
    cut: "13602",
    lat: -33.6958, lng: -71.0210,
    poblacion: 34893,
    direccion_municipal: "Bilbao 530, El Monte",
    url_municipal: "https://www.elmonte.cl",
    wiki_url: "https://es.wikipedia.org/wiki/El_Monte_(Chile)",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Escudo_de_El_Monte.svg/200px-Escudo_de_El_Monte.svg.png"
  },
  {
    comuna: "Isla de Maipo",
    provincia: "Provincia Talagante",
    cut: "13603",
    lat: -33.7487, lng: -70.8990,
    poblacion: 37167,
    direccion_municipal: "Rodriguez 561, Isla de Maipo",
    url_municipal: "https://www.islasedemaipo.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Isla_de_Maipo",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Escudo_de_Isla_de_Maipo.svg/200px-Escudo_de_Isla_de_Maipo.svg.png"
  },
  {
    comuna: "Padre Hurtado",
    provincia: "Provincia Talagante",
    cut: "13604",
    lat: -33.5597, lng: -70.8212,
    poblacion: 75471,
    direccion_municipal: "Av. Las Parcelas 150, Padre Hurtado",
    url_municipal: "https://www.padrehurtado.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Padre_Hurtado_(Chile)",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Escudo_Padre_Hurtado.svg/200px-Escudo_Padre_Hurtado.svg.png"
  },
  {
    comuna: "Peñaflor",
    provincia: "Provincia Talagante",
    cut: "13605",
    lat: -33.6100, lng: -70.8830,
    poblacion: 103000,
    direccion_municipal: "Casanova 60, Peñaflor",
    url_municipal: "https://www.munipeniaflor.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Pe%C3%B1aflor",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Escudo_de_Pe%C3%B1aflor.svg/200px-Escudo_de_Pe%C3%B1aflor.svg.png"
  },

  // ── Provincia Melipilla ────────────────────────────────────────────────────
  {
    comuna: "Melipilla",
    provincia: "Provincia Melipilla",
    cut: "13501",
    lat: -33.6897, lng: -71.2121,
    poblacion: 130820,
    direccion_municipal: "Manuel de Salas 449, Melipilla",
    url_municipal: "https://www.munimelipilla.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Melipilla",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Escudo_de_Melipilla.svg/200px-Escudo_de_Melipilla.svg.png"
  },
  {
    comuna: "Alhué",
    provincia: "Provincia Melipilla",
    cut: "13502",
    lat: -34.0250, lng: -71.1210,
    poblacion: 5271,
    direccion_municipal: "Balmaceda 125, Alhué",
    url_municipal: "https://www.alhue.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Alhu%C3%A9",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Escudo_de_Alhu%C3%A9.svg/200px-Escudo_de_Alhu%C3%A9.svg.png"
  },
  {
    comuna: "Curacaví",
    provincia: "Provincia Melipilla",
    cut: "13503",
    lat: -33.3978, lng: -71.1400,
    poblacion: 33438,
    direccion_municipal: "Camino Real s/n, Curacaví",
    url_municipal: "https://www.curacavi.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Curacav%C3%AD",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Escudo_de_Curacav%C3%AD.svg/200px-Escudo_de_Curacav%C3%AD.svg.png"
  },
  {
    comuna: "María Pinto",
    provincia: "Provincia Melipilla",
    cut: "13504",
    lat: -33.5208, lng: -71.1527,
    poblacion: 14827,
    direccion_municipal: "Arturo Prat 211, María Pinto",
    url_municipal: "https://www.mariapinto.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Mar%C3%ADa_Pinto",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Escudo_de_Mar%C3%ADa_Pinto.svg/200px-Escudo_de_Mar%C3%ADa_Pinto.svg.png"
  },
  {
    comuna: "San Pedro",
    provincia: "Provincia Melipilla",
    cut: "13505",
    lat: -33.8867, lng: -71.4700,
    poblacion: 11690,
    direccion_municipal: "Av. Bernardo O'Higgins 620, San Pedro de Melipilla",
    url_municipal: "https://www.munisp.cl",
    wiki_url: "https://es.wikipedia.org/wiki/San_Pedro_(Melipilla)",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Escudo_de_San_Pedro_(Melipilla).svg/200px-Escudo_de_San_Pedro_(Melipilla).svg.png"
  },

  // ── Provincia Chacabuco ────────────────────────────────────────────────────
  {
    comuna: "Colina",
    provincia: "Provincia Chacabuco",
    cut: "13301",
    lat: -33.2041, lng: -70.6722,
    poblacion: 156044,
    direccion_municipal: "Av. El Roble 4501, Colina",
    url_municipal: "https://www.muniocolina.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Colina_(Chile)",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Escudo_de_Colina.svg/200px-Escudo_de_Colina.svg.png"
  },
  {
    comuna: "Lampa",
    provincia: "Provincia Chacabuco",
    cut: "13302",
    lat: -33.2860, lng: -70.8800,
    poblacion: 91897,
    direccion_municipal: "Condell 999, Lampa",
    url_municipal: "https://www.munilampa.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Lampa",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Escudo_de_Lampa.svg/200px-Escudo_de_Lampa.svg.png"
  },
  {
    comuna: "Tiltil",
    provincia: "Provincia Chacabuco",
    cut: "13303",
    lat: -33.0822, lng: -70.9260,
    poblacion: 15754,
    direccion_municipal: "O'Higgins 10, Tiltil",
    url_municipal: "https://www.munitiltil.cl",
    wiki_url: "https://es.wikipedia.org/wiki/Til_Til",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Escudo_de_Til_Til.svg/200px-Escudo_de_Til_Til.svg.png"
  }
];

// ──────────────────────────────────────────────────────────────────────────────
//  Generar JSON estructurado igual que el original (agrupado por provincia)
// ──────────────────────────────────────────────────────────────────────────────
const PROVINCIAS_ORDER = [
  "Provincia de Santiago",
  "Provincia Cordillera",
  "Provincia Maipo",
  "Provincia Talagante",
  "Provincia Melipilla",
  "Provincia Chacabuco",
];

const grouped = {};
for (const prov of PROVINCIAS_ORDER) {
  grouped[prov] = COMUNAS
    .filter(c => c.provincia === prov)
    .map(({ provincia: _, ...rest }) => rest); // omit provincia from nested object
}

const outPath = resolve(__dirname, '../src/data/comunas-metropolitanas.json');
writeFileSync(outPath, JSON.stringify(grouped, null, 2), 'utf-8');
console.log(`✅  Escrito: ${outPath}`);
console.log(`📊  Total comunas: ${COMUNAS.length}`);
PROVINCIAS_ORDER.forEach(p => {
  console.log(`   ${p}: ${grouped[p].length} comunas`);
});
