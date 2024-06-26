import fs from 'fs';
import csv from 'csv-parser';
import * as d3 from 'd3';

const cityToRegionMap = {
    'amstetten': 'amstetten',
    'sankt valentin 1': 'amstetten',
    'kematen ybbs': 'amstetten',
    'kollmitzberg': 'amstetten',
    'bad vöslau': 'baden',
    'forsthof': 'baden',
    'hainburg': 'bruck an der leitha',
    'himberg': 'bruck an der leitha',
    'stixneusiedl': 'bruck an der leitha',
    'schwechat': 'bruck an der leitha',
    'vie schwechat': 'bruck an der leitha',
    'gänserndorf': 'gänserndorf',
    'großenzersdorf 2': 'gänserndorf',
    'heidenreichstein': 'gmünd',
    'ziersdorf': 'hollabrun',
    'irnfritz': 'horn',
    'stockerau': 'korneuburg',
    'krems': 'krems',
    'annaberg': 'lilienfeld',
    'dunkelsteinerwald': 'melk',
    'poechlarn': 'melk',
    'mistelbach': 'mistelbach',
    'wolkersdorf': 'mistelbach',
    'biedermannsdorf': 'mödling',
    'mödling': 'mödling',
    'wiener neudorf': 'mödling',
    'payerbach': 'neunkirchen',
    'st pölten': 'st pölten',
    'purkersdorf': 'st pölten',
    'st pölten verkehr': 'st pölten',
    'klosterneuburg b14': 'tulln',
    'klosterneuburg': 'tulln',
    'trasdorf': 'tulln',
    'tulln': 'tulln',
    'zwentendorf': 'tulln',
    'wiesmath': 'wr neustadt',
    'wiener neustadt': 'wr neustadt'
};

const regionToCodeMap = {
    'amstetten': 'AM',
    'baden': 'BN',
    'bruck an der leitha': 'BL',
    'gänserndorf': 'GF',
    'gmünd': 'GD',
    'hollabrun': 'HL',
    'horn': 'HO',
    'korneuburg': 'KO',
    'krems': 'KS',
    'lilienfeld': 'LF',
    'melk': 'ME',
    'mistelbach': 'MI',
    'mödling': 'MD',
    'neunkirchen': 'NK',
    'st pölten': 'P',
    'tulln': 'TU',
    'wr neustadt': 'WB'
};



function parseCSVFiles() {
    const directory = './data';

    fs.readdir(directory, (err, files) => {
        if (err) {
            console.error('Error reading directory:', err);
            return;
        }

        const aggregatedData = {
            ozon: {
                stations: []
                // {
                //     name: 'Station Name',
                //     region: 'Region Name',
                //     measurements: [WERTNN1, WERTNN2, ...]
                // }
                // ]
            },
            pm10: {
                stations: []
                // {
                //     name: 'Station Name',
                //     region: 'Region Name',
                //     measurements: [WERTNN1, WERTNN2, ...]
                // }
                // ]
            }
        };


        files.forEach((file, i) => {
            const filePath = `${directory}/${file}`;

            // aggregatedData[dataProp].stations = new Array();
            const stationData = new Array();

            fs.createReadStream(filePath)
            .pipe(csv({ separator: ';' })) // Specify the separator here
            .on('data', (data) => {
                const measurements = [];
                Object.entries(data).forEach(([key, value]) => {
                // Collect measurements from keys with WertNN pattern
                if (key.toLowerCase().includes('wert')) {
                    measurements.push(value);
                }
                });

                const name = data['Station'].replace(/[^a-zA-Z]/g, '').replace(/\s/g, '').toLowerCase();

                const station = {
                    name: name,
                    region: cityToRegionMap[name],
                    measurements: measurements
                }

                stationData.push(station);
            })
            .on('end', () => {
                console.log(`Finished parsing ${file}`);
                const prop = file.includes('Ozon') ? 'ozon' : 'pm10';
                aggregatedData[prop].stations = stationData;

            
                // Average out the arrays per index according to their common region
                Object.values(aggregatedData).forEach((data) => {
                    const { stations } = data;
                    const regionToMeasurementsMap = {};

                    // Group measurements by region
                    stations.forEach((station) => {
                        const { region, measurements } = station;
                        if (!regionToMeasurementsMap[region]) {
                            regionToMeasurementsMap[region] = [];
                        }
                        regionToMeasurementsMap[region].push(measurements);
                    });

                    // Calculate average per index for each region
                    Object.entries(regionToMeasurementsMap).forEach(([region, measurementsArray]) => {
                        const numMeasurements = measurementsArray[0].length;
                        const averageMeasurements = new Array(numMeasurements).fill(0);

                        measurementsArray.forEach((measurements) => {
                            measurements.forEach((measurement, index) => {
                                averageMeasurements[index] += parseFloat(measurement);
                            });
                        });

                        averageMeasurements.forEach((average, index) => {
                            averageMeasurements[index] = average / measurementsArray.length;
                        });

                        // Update the aggregated data with the average measurements
                        const regionStations = stations.filter((station) => station.region === region);
                        regionStations.forEach((station) => {
                            station.measurements = averageMeasurements;
                        });
                    });
                });

                const ozonData = aggregatedData.ozon.stations;
                const pm10Data = aggregatedData.pm10.stations;
                console.log(pm10Data);

                // filter out the unique regions and the measurements from the data
                const regions = new Set();
                const ozonMeasurements = [];
                const pm10Measurements = [];

                ozonData.forEach((station) => {
                    regions.add(station.region);
                    ozonMeasurements.push(station.measurements);
                });

                pm10Data.forEach((station) => {
                    regions.add(station.region);
                    pm10Measurements.push(station.measurements);
                });


                const finalData = {};
                regions.forEach((region) => {

                    finalData[region] = {
                        ozone: aggregatedData.ozon.stations.filter((station) => {
                            return station.region === region;
                        }),
                        pm10: aggregatedData.pm10.stations.filter((station) => {
                            return station.region === region;
                        })
                    }; 
                });
                const allFilesParsed = files.length === i + 1;
            
                if(allFilesParsed) {
                    const ozoneMin = d3.min(ozonMeasurements.flat());
                    const ozoneMax = d3.max(ozonMeasurements.flat());
                    console.log('Ozone Min:', ozoneMin);
                    console.log('Ozone Max:', ozoneMax);

                    const pm10Min = d3.min(pm10Measurements.flat());
                    const pm10Max = d3.max(pm10Measurements.flat());
                    console.log('PM10 Min:', pm10Min);
                    console.log('PM10 Max:', pm10Max);

                    // calculate sqrtScaLe using d3 for both ozone and pm10
                    const sqrtScaleOzone = d3.scaleSqrt()
                        .domain([ozoneMin, ozoneMax])
                        .range([5, 20]);

                    const sqrtScalePM10 = d3.scaleSqrt()
                    .domain([ozoneMin, ozoneMax])
                    .range([5, 20]);

                    // Map the measurements to the scale output
                    Object.entries(finalData).forEach(([region, data]) => {
                        const { ozone, pm10 } = data;

                        ozone.forEach((station) => {
                            const { measurements } = station;
                            const scaledMeasurements = measurements.map((measurement) => sqrtScaleOzone(measurement));
                            station.scaledMeasurements = new Array();
                            station.scaledMeasurements = scaledMeasurements;
                        });

                        pm10.forEach((station) => {
                            const { measurements } = station;
                            const scaledMeasurements = measurements.map((measurement) => sqrtScalePM10(measurement));
                            station.scaledMeasurements = new Array();
                            station.scaledMeasurements = scaledMeasurements;
                        });
                    });
                    // Filter out the finalData to have only 1 element per region
                    const filteredData = {};
                    Object.entries(finalData).forEach(([region, data]) => {
                        const { ozone, pm10 } = data;
                        // get the region 2 char code
                        const code = regionToCodeMap[region];
                        filteredData[code] = {
                            ozone: { measurements: ozone[0] ? ozone[0].measurements : [], scaledMeasurements: ozone[0] ? ozone[0].scaledMeasurements : [] },
                            pm10: { measurements: pm10[0] ? pm10[0].measurements : [], scaledMeasurements: pm10[0] ? pm10[0].scaledMeasurements : [] }
                        };
                    });

                    const jsonData = JSON.stringify(filteredData);
                    fs.writeFile('noe_air_quality.json', jsonData, (err) => {
                        if (err) {
                            console.error('Error writing JSON file:', err);
                            return;
                        }
                        console.log('Final data written to noe_air_quality.json');
                    });
                }
            });

        });
    });    
}

function processMaps() {
    for (let key in cityToRegionMap) {
            const newKey = key.replace(/[^a-zA-Z]/g, '').replace(/\s/g, '').toLowerCase();
            const newValue = cityToRegionMap[key].replace(/[^a-zA-Z]/g, '').replace(/\s/g, '').toLowerCase();
            delete cityToRegionMap[key];
            cityToRegionMap[newKey] = newValue;
    }

    for (let key in regionToCodeMap) {
            const newKey = key.replace(/[^a-zA-Z]/g, '').trim().toLowerCase();
            const value = regionToCodeMap[key];
            delete regionToCodeMap[key];
            regionToCodeMap[newKey] = value;
    }

    console.log(regionToCodeMap)
}



processMaps();
parseCSVFiles();
