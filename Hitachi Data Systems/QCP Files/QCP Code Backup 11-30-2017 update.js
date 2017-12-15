//QCP Code
			var isChainingDone = false;
			//init Function
			export function onInit(lines, conn) {
				
					  var allLines = lines;
				//Null lines check
			  if (lines != null && lines.length > 0) {
				
				var quoteId = lines[0].record['SBQQ__Quote__c'];
				var objQuote;
				//Query SBQQ__Quote__c
				var query = "SELECT Id,Partner_Level__c,Renewal_Contract_Package__r.Do_Not_Apply_Customer_Partner_Discount__c , Partner_Service_Capability__c,Account_Class__c,Geo__c,Region__c, District__c, Install_At_Country__c,SBQQ__BillingCountry__c,Bill_To_Account__c,Bill_To_Account__r.SiteNumber__c,End_User_Category__c FROM SBQQ__Quote__c WHERE Id ='" + quoteId + "' LIMIT 1";
				console.log(query);
				/*
				 * conn.query() returns a Promise that resolves when the query completes.
				 * refrence :: https://community.steelbrick.com/t5/Developer-Guidebook/JS-Quote-Calculator-Plugin-Template-amp-Samples/ta-p/5787
				 */
				 
				return conn.query(query)
				  .then(function(results) {
					if (results.totalSize) {
						//logResultSize(lines,'None','Quote Lines recieved');
					  objQuote = results.records[0];
					  //Calling RAF Discount Function
					  initRAFDiscountRule1(lines, conn, objQuote,lines);
					  
					}
				  });


			  }


			};


			export function onBeforeCalculate(quoteModel, lines) {
				return Promise.resolve();
			};
			/*export function onAfterCalculate(quoteModel, lines) {
			};*/

			export function onAfterCalculate(quote, lineModels) {
			console.log('Start onAfterCalculate ======== ' + lineModels);
			  if (lineModels != null) {
				lineModels.forEach(function(line) {
				  var effectiveTerm = getEffectiveSubscriptionTerm(quote, line);
				  line.record["Effective_Term__c"] = effectiveTerm;
				  var effectiveEndDate = calculateEndDate(quote, line);
				  line.record["Effective_End_Date__c"] = effectiveEndDate.valueOf();
				});
			  }  
			  
				console.log('Start onAfterCalculate ======== ' + lineModels);
			  return Promise.resolve();
			}

			function getEffectiveSubscriptionTerm(quote, line) {
				
			  var startd = line.record["SBQQ__EffectiveStartDate__c"];
			  var endd = line.record["SBQQ__EffectiveEndDate__c"];
			  var sd = new Date(startd);
			  sd = Date.parse(startd);
			  var ed = new Date(endd);
			  ed = Date.parse(endd);
			console.log('Start getEffectiveSubscriptionTerm ======== ' + line);
			console.log('Start getEffectiveSubscriptionTerm ======== ' + startd);
			console.log('Start getEffectiveSubscriptionTerm ======== ' + endd);
			console.log('Start getEffectiveSubscriptionTerm ======== ' + sd +'========='+ ed);
			  if (startd != null && endd != null) {
				ed.setUTCDate(ed.getUTCDate() + 1);
				return monthsBetween(sd, ed);
			  }
			  else if (line.SBQQ__SubscriptionTerm__c != null) {
				return line.SBQQ__SubscriptionTerm__c;
			  }
			  else if (quote.SBQQ__SubscriptionTerm__c != null) {
				return quote.SBQQ__SubscriptionTerm__c;
			  }
			  else {
				return line.SBQQ__DefaultSubscriptionTerm__c;
			  }
			}
						
			function calculateEndDate(quote, line) {
				
				
			  var startd = line.record["SBQQ__EffectiveStartDate__c"];
			  var endd = line.record["SBQQ__EffectiveEndDate__c"];
			  var sd = new Date(startd);
			  sd = Date.parse(startd);
			  var ed = new Date(endd);
			  ed = Date.parse(endd);
			console.log('Start getEffectiveSubscriptionTerm ======== ' + line);
			console.log('Start getEffectiveSubscriptionTerm ======== ' + startd);
			console.log('Start getEffectiveSubscriptionTerm ======== ' + endd);
			console.log('Start getEffectiveSubscriptionTerm ======== ' + sd +'========='+ ed);
			  if (startd != null && endd == null) {
				ed = sd;
				ed.setUTCMonth(ed.getUTCMonth() + getEffectiveSubscriptionTerm(quote, line));
				ed.setUTCDate(ed.getUTCDate() - 1);
				endd = ed;
			  }
			  return endd;
			}

			function monthsBetween(startDate, endDate) {
			console.log('Start getEffectiveSubscriptionTerm ======== ' + startDate);
			console.log('Start getEffectiveSubscriptionTerm ======== ' + endDate);
			  // If the start date is actually after the end date, reverse the arguments and multiply the result by - 1
			  if (startDate > endDate) {
				return -1 * monthsBetween(endDate, startDate);
			  }
			  var result = 0;
			  // Add the difference in years * 12
			  result += ((endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12);
			  // Add the difference in months. Note: If startDate was later in the year than endDate, this value will be subtracted.
			  result += (endDate.getUTCMonth() - startDate.getUTCMonth());
			  return result;
			}
			
			
			//RAF Discount Rule 1
			//Rule 1 :: Match product P code (Name) and installAtCountry
			//Rule 2 :: Match product P code (Name) and Region
			//Rule 3 :: Match product P code (Name) and Geo
			
			function initRAFDiscountRule1(lines,conn, objQuote, allLines){
				var productPcodeSet = [];
				var quoteInstallAtCountry = objQuote.Install_At_Country__c;
				var quoteGeo = objQuote.Geo__c;
				var quoteRegion = objQuote.Region__c;
				var quoteDistrict = objQuote.District__c;
				
				lines.forEach(function(line) {
					var productPCode = line.record['SBQQ__Product__c'];
					if (productPCode && productPcodeSet.indexOf(productPCode) < 0) {
					  productPcodeSet.push(productPCode);
					}
				});
				
				var rafSelectQuery = 'SELECT Adjustment_Amount__c,Adjustment_Type__c,CurrencyIsoCode,Date_From__c,Date_To__c,District__c,DM_Name__c,Effective_From__c,Effective_To__c,Geo__c,Id,Install_At_Country__c,Name,Pricing_Category__c,Product_Family__c,Product_Name__c,Product__c,Region__c,Service_Sub_Type__c,Siebel_DM_Number__c FROM Lookup_RAF__c ';
				var whereClause = " WHERE ";
				var andConditions = "";
				var conditions = "";
				if(productPcodeSet.length){
					
					var productPcodeList = "('" + productPcodeSet.join("', '") + "')";
					if(andConditions)
						andConditions = andConditions + ' AND ';
					
					andConditions = andConditions +' (Product__c IN ' + productPcodeList + ')';
				}
				
				if(andConditions)
					rafSelectQuery = rafSelectQuery + whereClause + andConditions;
				console.log('RAF discount rule 1:' + rafSelectQuery);
				var mapRAFProdcutCodeInstallAtCountry = {};
				var mapRAFProdcutCodeRegion = {};
				var mapRAFProdcutCodeGeo = {};
				var a = 0;
				
				conn.query(rafSelectQuery)
				.then(function(results) {		
					logResultSize(results,rafSelectQuery,'RAF discount rule 1');
					if (results.totalSize) {
						results.records.forEach(function(record) {          
						  var objValue = createObjectValue(record);
						  var installAtCountryKey = record.Install_At_Country__c + record.Product__c;
						  mapRAFProdcutCodeInstallAtCountry[installAtCountryKey] = objValue;
						  
						  var regionKey = record.Region__c + record.Product__c;
						  mapRAFProdcutCodeRegion[regionKey] = objValue;
						  
						  var geoKey = record.Geo__c + record.Product__c;
						  mapRAFProdcutCodeGeo[geoKey] = objValue;
						});
					}
					
					var remainingLines = [];
					lines.forEach(function(line) {
						var obj;
						var installAtCountryKey = quoteInstallAtCountry + line.record['SBQQ__Product__c'];
						var regionKey = quoteRegion + line.record['SBQQ__Product__c'];
						var geoKey =  quoteGeo + line.record['SBQQ__Product__c'];
						
						if (installAtCountryKey in mapRAFProdcutCodeInstallAtCountry) {
						  obj = mapRAFProdcutCodeInstallAtCountry[installAtCountryKey];
						}else if (regionKey in mapRAFProdcutCodeRegion) {
							obj = mapRAFProdcutCodeRegion[regionKey];
						}
						else if (geoKey in mapRAFProdcutCodeGeo) {
							obj = mapRAFProdcutCodeGeo[geoKey];
						}

						if (obj) {
						  applyDiscountsOnLineItemRAF(line, obj, 'RAF Rule 1');
						}
						else {
						  remainingLines.push(line);
						}

					});
					console.log('Remaining Lines after RAF rule1:' + remainingLines.length);

					//We will pass the remaining lines to the new set of rules 
					if (remainingLines.length) {
						console.log('Inside remaining lines: RAF ');
						initRAFDiscountRule2(remainingLines, conn, objQuote,allLines);
					}else{
						chainCustomerPartnerDiscountRules(remainingLines, conn, objQuote,allLines);
					}
				});
			}
			
			//RAF Discount Rule 1
			//Rule 1 :: Match product Family, Product Category and installAtCountry
			//Rule 2 :: Match product Family, Product Category and Region
			//Rule 3 :: Match product Family, Product Category and Geo

			function initRAFDiscountRule2(lines,conn, objQuote,allLines){
				var productFamilySet = [];
				var productCategorySet = [];
				var quoteInstallAtCountry = objQuote.Install_At_Country__c;
				var quoteGeo = objQuote.Geo__c;
				var quoteRegion = objQuote.Region__c;
				var quoteDistrict = objQuote.District__c;
				
				lines.forEach(function(line) {
					var productFamily = line.record['SBQQ__ProductFamily__c'];
					var productCategory = line.record['Product_Type__c']
					if (productFamily && productFamilySet.indexOf(productFamily) < 0) {
					  productFamilySet.push(productFamily);
					}
					if (productCategory && productCategorySet.indexOf(productCategory) < 0) {
					  productCategorySet.push(productCategory);
					}
				});
				
				var rafSelectQuery = 'SELECT Adjustment_Amount__c,Adjustment_Type__c,CurrencyIsoCode,Date_From__c,Date_To__c,District__c,DM_Name__c,Effective_From__c,Effective_To__c,Geo__c,Id,Install_At_Country__c,Name,Pricing_Category__c,Product_Family__c,Product_Name__c,Product__c,Region__c,Service_Sub_Type__c,Siebel_DM_Number__c FROM Lookup_RAF__c ';
				var whereClause = " WHERE ";
				var andConditions = "";
				var conditions = "";
				
				if(productFamilySet.length){
					var productFamilyList = "('" + productFamilySet.join("', '") + "')";
					
					if(andConditions)
						andConditions = andConditions + ' AND ';
					
					andConditions =  andConditions + ' (Product_Family__c IN ' + productFamilyList + ')';
				}
				
				if(productCategorySet.length){
					var productCategoryList = "('" + productCategorySet.join("', '") + "')";
					
					if(andConditions)
						andConditions = andConditions + ' AND ';
					
					andConditions = andConditions + ' (Pricing_Category__c IN ' + productCategoryList + ')';
				}
				
				if(andConditions)
					rafSelectQuery = rafSelectQuery + whereClause + andConditions;
				
				console.log('RAF discount rule 2:' + rafSelectQuery);
				var mapRAFProdcutFamilyCategoryInstallAtCountry = {};
				var mapRAFProdcutFamilyCategoryRegion = {};
				var mapRAFProdcutFamilyCategoryGeo = {};
				
				conn.query(rafSelectQuery)
				.then(function(results) {		
					logResultSize(results,rafSelectQuery,'RAF discount rule 2');
					if (results.totalSize) {
						results.records.forEach(function(record) {          
						  var objValue = createObjectValue(record);
						  var installAtCountryKey =  record.Install_At_Country__c + record.Product_Family__c + record.Pricing_Category__c;
						  mapRAFProdcutFamilyCategoryInstallAtCountry[installAtCountryKey] = objValue;
						  
						  var regionKey = record.Region__c + record.Product__c + record.Pricing_Category__c;
						  mapRAFProdcutFamilyCategoryRegion[regionKey] = objValue;
						  
						  var geoKey = record.Geo__c +record.Product__c + record.Pricing_Category__c;
						  mapRAFProdcutFamilyCategoryGeo[geoKey] = objValue;
						});
					}
					var remainingLines = [];
					lines.forEach(function(line) {
						var obj;
						var installAtCountryKey = line.record['SBQQ__Product__c'] + quoteInstallAtCountry;
						var regionKey = line.record['SBQQ__Product__c'] + quoteRegion;
						var geoKey = line.record['SBQQ__Product__c'] + quoteGeo;
						
						if (installAtCountryKey in mapRAFProdcutFamilyCategoryInstallAtCountry) {
						  obj = mapRAFProdcutFamilyCategoryInstallAtCountry[installAtCountryKey];
						}else if (regionKey in mapRAFProdcutFamilyCategoryRegion) {
							obj = mapRAFProdcutFamilyCategoryRegion[regionKey];
						}
						else if (geoKey in mapRAFProdcutFamilyCategoryGeo) {
							obj = mapRAFProdcutFamilyCategoryGeo[geoKey];
						}

						if (obj) {
						  applyDiscountsOnLineItemRAF(line, obj, 'RAF Rule 2');
						}
						else {
						  remainingLines.push(line);
						}

					});
					console.log('Remaining Lines after RAF rule 2:' + remainingLines.length);

					//We will pass the remaining lines to the new set of rules 
					if (remainingLines.length) {
						console.log('Inside remaining lines: RAF ');
						initRAFDiscountRule3(remainingLines, conn, objQuote, allLines);
					}else{
						chainCustomerPartnerDiscountRules(remainingLines, conn, objQuote,allLines);
					}
				});
			}
			
			
			//RAF Discount Rule 1
			//Rule 1 :: Match product Family, Product Service Sub Type and installAtCountry
			//Rule 2 :: Match product Family, Product Service Sub Type and Region
			//Rule 3 :: Match product Family, Product Service Sub Type and Geo
			
			function initRAFDiscountRule3(lines,conn, objQuote,allLines){
				var productFamilySet = [];
				var productServiceSubTypeSet = [];
				var quoteInstallAtCountry = objQuote.Install_At_Country__c;
				var quoteGeo = objQuote.Geo__c;
				var quoteRegion = objQuote.Region__c;
				var quoteDistrict = objQuote.District__c;
				
				lines.forEach(function(line) {
					var productFamily = line.record['SBQQ__ProductFamily__c'];
					var productServiceSubType = line.record['HDSServiceSubType__c'];
					
					if (productFamily && productFamilySet.indexOf(productFamily) < 0) {
					  productFamilySet.push(productFamily);
					}
					if (productServiceSubTypeSet && productServiceSubTypeSet.indexOf(productServiceSubType) < 0) {
					  productServiceSubTypeSet.push(productServiceSubType);
					}
				});
				
				
				var rafSelectQuery = 'SELECT Adjustment_Amount__c,Adjustment_Type__c,CurrencyIsoCode,Date_From__c,Date_To__c,District__c,DM_Name__c,Effective_From__c,Effective_To__c,Geo__c,Id,Install_At_Country__c,Name,Pricing_Category__c,Product_Family__c,Product_Name__c,Product__c,Region__c,Service_Sub_Type__c,Siebel_DM_Number__c FROM Lookup_RAF__c ';
				var whereClause = " WHERE ";
				var andConditions = "";
				var conditions = "";
				
				if(productFamilySet.length){
					var productFamilyList = "('" + productFamilySet.join("', '") + "')";
					
					if(andConditions)
						andConditions = andConditions + ' AND ';
								
					andConditions = andConditions + ' (Product_Family__c IN ' + productFamilyList + ')';
					
				}
				
				if(productServiceSubTypeSet.length){
					var productServiceTypeList = "('" + productServiceSubTypeSet.join("', '") + "')";
					if(andConditions)
						andConditions = andConditions + ' AND ';
					
					andConditions = andConditions + ' (Service_Sub_Type__c IN ' + productServiceTypeList + ')';
				}
				
				if(andConditions)
					rafSelectQuery = rafSelectQuery + whereClause + andConditions;
				
				console.log('RAF discount rule 3:' + rafSelectQuery);
				var mapRAFProdcutFamilyServiceSubtypeInstallAtCountry = {};
				var mapRAFProdcutFamilyServiceSubtypeRegion = {};
				var mapRAFProdcutFamilyServiceSubtypeGeo = {};
				
				conn.query(rafSelectQuery)
				.then(function(results) {		
					logResultSize(results,rafSelectQuery,'RAF discount rule 3');
					if (results.totalSize) {
						results.records.forEach(function(record) {          
						  var objValue = createObjectValue(record);
						  var installAtCountryKey =  record.Install_At_Country__c + record.Product_Family__c + record.Service_Sub_Type__c;
						  mapRAFProdcutFamilyServiceSubtypeInstallAtCountry[installAtCountryKey] = objValue;
						  
						  var regionKey = record.Region__c + record.Product__c + record.Service_Sub_Type__c;
						  mapRAFProdcutFamilyServiceSubtypeRegion[regionKey] = objValue;
						  
						  var geoKey = record.Geo__c +record.Product__c + record.Service_Sub_Type__c;
						  mapRAFProdcutFamilyServiceSubtypeGeo[geoKey] = objValue;
						});
					}
					var remainingLines = [];
					lines.forEach(function(line) {
						var obj;
						var installAtCountryKey = line.record['SBQQ__Product__c'] + quoteInstallAtCountry;
						var regionKey = line.record['SBQQ__Product__c'] + quoteRegion;
						var geoKey = line.record['SBQQ__Product__c'] + quoteGeo;
						
						if (installAtCountryKey in mapRAFProdcutFamilyServiceSubtypeInstallAtCountry) {
						  obj = mapRAFProdcutFamilyServiceSubtypeInstallAtCountry[installAtCountryKey];
						}else if (regionKey in mapRAFProdcutFamilyServiceSubtypeRegion) {
							obj = mapRAFProdcutFamilyServiceSubtypeRegion[regionKey];
						}
						else if (geoKey in mapRAFProdcutFamilyServiceSubtypeGeo) {
							obj = mapRAFProdcutFamilyServiceSubtypeGeo[geoKey];
						}

						if (obj) {
						  applyDiscountsOnLineItemRAF(line, obj, 'RAF Rule 3');
						}
						else {
						  remainingLines.push(line);
						}

					});
					console.log('Remaining Lines after RAF rule 3:' + remainingLines.length);

					//We will pass the remaining lines to the new set of rules 
					if (remainingLines.length) {
						console.log('remaining lines After all Rule processed: RAF ' + remainingLines.length);
					}
					chainCustomerPartnerDiscountRules(remainingLines, conn, objQuote,allLines);
				});
			}
			
			
			//Customer Discount Rule 1
			//Rule 1 :: Match product P code (Name)
			function initCustomerDiscountRule1(lines, conn, objQuote) {
			  //This is the first customer discount rule which is just dependent on VSOE Discount Category
			  var vsoeDiscountCategories = [];
			  //Getting VSOE_Discount__c Set
			  lines.forEach(function(line) {

				var vsoeDiscountCategory = line.record['VSOE_Discount__c'];

				if (vsoeDiscountCategory && vsoeDiscountCategories.indexOf(vsoeDiscountCategory) < 0) {
				  vsoeDiscountCategories.push(vsoeDiscountCategory);
				}
			  });
				//Creating Query
			  var customerSelectQuery = 'SELECT Id,Adjustment_Amount__c,Adjustment_Type__c,Service_Sub_Type__c,End_User_Category__c,VSOE_Discount_Category__c FROM Lookup_Customer_Discount__c ';
			  var whereClause = " WHERE ";

			  var orConditions = '';
			  if (vsoeDiscountCategories.length) {

				var vsoeDiscountList = "('" + vsoeDiscountCategories.join("', '") + "')";
				if (orConditions) {
				  orConditions = orConditions + ' OR ' + ' (VSOE_Discount_Category__c IN ' + vsoeDiscountList + ')';
				}
				else {
				  orConditions = '  (VSOE_Discount_Category__c IN ' + vsoeDiscountList + ')';
				}
				orConditions = '  (' + orConditions + ')';
			  }
			  var query = customerSelectQuery;
			  if (orConditions) {
				query = query + whereClause + orConditions;
			  }
			  console.log('Customer discount rule 1:' + query);
			  var mapCustomerDiscount1VSOE = {};
			  
				//Iterating over all the results that was queried for CustomerDiscount lookup and creating map
			  conn.query(query)
				.then(function(results) {		
					logResultSize(results,query,'Customer discount rule 1');
				  if (results.totalSize) {

					results.records.forEach(function(record) {          
					  var objValue = createObjectValue(record);
					  var vsoeKey = record.Service_Sub_Type__c + record.VSOE_Discount_Category__c + record.End_User_Category__c;
					  mapCustomerDiscount1VSOE[vsoeKey] = objValue;

					});
				  }

				  var remainingLines = [];
				  lines.forEach(function(line) {
					var obj;
					var customerVSOEKey = line.record['HDSServiceSubType__c'] + line.record['VSOE_Discount__c'] + objQuote.End_User_Category__c;
					if (customerVSOEKey in mapCustomerDiscount1VSOE) {
					  obj = mapCustomerDiscount1VSOE[customerVSOEKey];
					}

					if (obj) {
					  applyDiscountsOnLineItem(line, obj, 'Rule1');
					}
					else {
					  remainingLines.push(line);
					}

				  });
				  console.log('Remaining Lines after rule1:' + remainingLines.length);

				  //We will pass the remaining lines to the new set of rules 
				  if (remainingLines.length) {
					console.log('Inside remaining lines:');
					initCustomerDiscountRule2(remainingLines, conn, objQuote);
				  }

				});

			}


			//Customer Discount Rule 2
			//Makes rules 2-6 match based on Bill to Account and bill To Site 
			//Rule 2 Match the product .p code to Bill To Account and Bill To Site
			//Rule 3 Match the Bill To Account, Bill To Site, Product Line, and Service Sub Type 
			//Rule 4 Match the Bill To Account, Bill To Site, Product Line, and Pricing Category
			//Rule 5 Match the Bill To Account, Bill To Site, Product Family, and Service Sub Type
			//Rule 6 Match the Bill To Account, Bill To Site, Product Family, and Pricing Category
			function initCustomerDiscountRule2(lines, conn, objQuote) {
				
			  //This is the second customer discount rule 
			  var billToAccount = objQuote.Bill_To_Account__c;
			  var billToSite = objQuote.Bill_To_Account__r.SiteNumber__c;
			  
			  var customerSelectQuery = 'SELECT Id,Adjustment_Amount__c,Adjustment_Type__c,Service_Sub_Type__c,End_User_Category__c,Product_Family__c,Product_Line__c,Product__c,Bill_To_Account__c,Bill_To_Site__c,Pricing_Category__c FROM Lookup_Customer_Discount__c ';
			  var whereClause = " WHERE ";
			  var conditions;
			  //Creating Filter Set
			  if (billToAccount) {
				conditions = " Bill_To_Account__c  = '" + billToAccount + "'";
			  }
			  if (billToSite) {
				if (conditions) {
				  conditions += " AND Bill_To_Site__c ='" + billToSite + "'";
				}
				else {
				  conditions = "  Bill_To_Site__c ='" + billToSite + "'";
				}

			  }
			  
			  //Creating Query
			  var query = customerSelectQuery;
			  if (conditions) {
				query = query + whereClause + conditions;
			  }
			  console.log('Customer discount rule 2:' + query);

			  var mapCustomerDiscount2ProductPCode = {};
			  var mapCustomerDiscount2ProductLineSubType = {};
			  var mapCustomerDiscount2ProductLinePricingCategory = {};
			  var mapCustomerDiscount2ProductFamilySubType = {};
			  var mapCustomerDiscount2ProductFamilyPricingCategory = {};
			  //Iterating over all the results that was queried for CustomerDiscount lookup and creating map
			  conn.query(query)
				.then(function(results) {		
					logResultSize(results,query,'Customer discount rule 2');
				  if (results.totalSize) {
					results.records.forEach(function(record) {
					  
					  var objValue = createObjectValue(record);

					  var productCodeKey = record.Product__c + record.Bill_To_Account__c + record.Bill_To_Site__c;
					  mapCustomerDiscount2ProductPCode[productCodeKey] = objValue;

					  var productLineSubTypeKey = record.Bill_To_Account__c + record.Bill_To_Site__c + record.Product_Line__c + record.Service_Sub_Type__c;
					  mapCustomerDiscount2ProductLineSubType[productLineSubTypeKey] = objValue;

					  var productLinePricingCategoryKey = record.Bill_To_Account__c + record.Bill_To_Site__c + record.Product_Line__c + record.Pricing_Category__c;
					  mapCustomerDiscount2ProductLinePricingCategory[productLinePricingCategoryKey] = objValue;

					  var productFamilySubTypeKey = record.Bill_To_Account__c + record.Bill_To_Site__c + record.Product_Family__c + record.Service_Sub_Type__c;
					  mapCustomerDiscount2ProductFamilySubType[productFamilySubTypeKey] = objValue;

					  var productFamilyPricingCategoryKey = record.Bill_To_Account__c + record.Bill_To_Site__c + record.Product_Family__c + record.Pricing_Category__c;
					  mapCustomerDiscount2ProductFamilyPricingCategory[productFamilyPricingCategoryKey] = objValue;

					});

				  }


				  var remainingLines = [];
				  lines.forEach(function(line) {

					var productCodeKey = line.record['SBQQ__Product__c'] + billToAccount + billToSite;
					var productLineSubTypeKey = billToAccount + billToSite + line.record['Product_Line__c'] + line.record['HDSServiceSubType__c'];
					var productLinePricingCategoryKey = billToAccount + billToSite + line.record['Product_Line__c']; + line.record['Product_Type__c'];
					var productFamilySubTypeKey = billToAccount + billToSite + line.record['SBQQ__ProductFamily__c'] + line.record['HDSServiceSubType__c'];
					var productFamilyPricingCategoryKey = billToAccount + billToSite + line.record['SBQQ__ProductFamily__c']; + line.record['Product_Type__c'];

					var obj;

					if (productCodeKey in mapCustomerDiscount2ProductPCode) {
					  obj = mapCustomerDiscount2ProductPCode[productCodeKey];
					}
					else if (productLineSubTypeKey in mapCustomerDiscount2ProductLineSubType) {
					  obj = mapCustomerDiscount2ProductLineSubType[productLineSubTypeKey];
					}
					else if (productLinePricingCategoryKey in mapCustomerDiscount2ProductLinePricingCategory) {
					  obj = mapCustomerDiscount2ProductLinePricingCategory[productLinePricingCategoryKey];
					}
					else if (productFamilySubTypeKey in mapCustomerDiscount2ProductFamilySubType) {
					  obj = mapCustomerDiscount2ProductFamilySubType[productFamilySubTypeKey];
					}
					else if (productFamilyPricingCategoryKey in mapCustomerDiscount2ProductFamilyPricingCategory) {
					  obj = mapCustomerDiscount2ProductFamilyPricingCategory[productFamilyPricingCategoryKey];
					}

					if (obj) {
					  applyDiscountsOnLineItem(line, obj, 'Rule2');
					}
					else {
					  remainingLines.push(line);
					}


				  });


				  console.log('Remaining Lines after rule2:' + remainingLines.length);
				  //We will pass the remaining lines to the new set of rules 
				  if (remainingLines.length) {
					initCustomerDiscountRule3(remainingLines, conn, objQuote);
				  }

				});

			}

			// Customer Discount Rule 3
			//Makes rules 7-12 match based on Service Sub Type  & End User Category 
			//Rule 7 Match Install At Country, Product Line, Service Sub Type, and End User Category 
			//Rule 8 Match Region (1st occurrence of Region?), Product Line, Service Sub Type, and End User Category 
			//Rule 9 Match GEO, Product Line, Service Sub Type, and End User Category
			//Rule 10 Match Install At Country, Product Family, Service Sub Type, and End User Category
			//Rule 11 Match Region (1st occurrence of Region?), Product Family, Service Sub Type, and End User Category
			//Rule 12 Match GEO, Product Family, Service Sub Type, and End User Category
			function initCustomerDiscountRule3(lines, conn, objQuote) {
			  //This is the third customer discount rule which is just dependent on Services sub type
			  var subTypes = [];
			  
			  var installAtCountry = objQuote.Install_At_Country__c;
			  var quoteGeo = objQuote.Geo__c;
			  var quoteRegion = objQuote.Region__c;
			  var quoteDistrict = objQuote.District__c;
			  
			  var endUserCategory = objQuote.End_User_Category__c;
			  var installAtCountry = objQuote.Install_At_Country__c;
			  //Creating filter Set
			  lines.forEach(function(line) {
				var subType = line.record['HDSServiceSubType__c'];

				if (subType && subTypes.indexOf(subType) < 0) {
				  subTypes.push(subType);
				}
			  });

			  var customerSelectQuery = 'SELECT Id,Adjustment_Amount__c,Adjustment_Type__c,Service_Sub_Type__c,End_User_Category__c,Install_At_Country__c,Region__c,Geo__c,District__c,Product_Family__c,Product_Line__c FROM Lookup_Customer_Discount__c ';
			  var whereClause = " WHERE ";

			  var orConditions = '';
			  if (subTypes.length) {

				var subTypeList = "('" + subTypes.join("', '") + "')";
				if (orConditions) {
				  orConditions = orConditions + ' OR ' + ' (Service_Sub_Type__c IN ' + subTypeList + ')';
				}
				else {
				  orConditions = '  (Service_Sub_Type__c IN ' + subTypeList + ')';
				}
				orConditions = '  (' + orConditions + ')';

			  }
			  
			  //Creating Query
			  var query = customerSelectQuery + whereClause + orConditions;
			  if (endUserCategory) {
				query += " AND End_User_Category__c = '" + endUserCategory + "'";
			  }
			  if (installAtCountry) {
				  if (endUserCategory) {
					query += " AND Install_At_Country__c = '" + installAtCountry + "'";
				  }else{			
					query += " Install_At_Country__c = '" + installAtCountry + "'";  
				  }
			  }
			  console.log('Customer discount rule 3:' + query);

			  var mapCustomerDiscount3CountryProductLine = {};
			  var mapCustomerDiscount3RegionProductLine = {};
			  var mapCustomerDiscount3GeoProductLine = {};
			  var mapCustomerDiscount3CountryProductFamily = {};
			  var mapCustomerDiscount3RegionProductFamily = {};
			  var mapCustomerDiscount3GeoProductFamily = {};
			  
				//Iterating over all the results that was queried for CustomerDiscount lookup and creating map
			  conn.query(query)
				.then(function(results) {
				  if (results.totalSize) {
					  
					logResultSize(results,query,'Customer discount rule 3');
					results.records.forEach(function(record) {
					  
					  var objValue = createObjectValue(record);

					  var countryProductLineKey = record.Install_At_Country__c + record.Product_Line__c + record.Service_Sub_Type__c + endUserCategory;
					  mapCustomerDiscount3CountryProductLine[countryProductLineKey] = objValue;

					  var regionProductLineKey = record.Region__c + record.Product_Line__c + record.Service_Sub_Type__c + endUserCategory;
					  mapCustomerDiscount3RegionProductLine[regionProductLineKey] = objValue;

					  var geoProductLineKey = record.Geo__c + record.Product_Line__c + record.Service_Sub_Type__c + endUserCategory;
					  mapCustomerDiscount3GeoProductLine[geoProductLineKey] = objValue;

					  var countryProductFamilyKey = record.Install_At_Country__c + record.Product_Family__c + record.Service_Sub_Type__c + endUserCategory;
					  mapCustomerDiscount3CountryProductFamily[countryProductFamilyKey] = objValue;

					  var regionProductFamilyKey = record.Region__c + record.Product_Family__c + record.Service_Sub_Type__c + endUserCategory;
					  mapCustomerDiscount3RegionProductFamily[regionProductFamilyKey] = objValue;

					  var geoProductFamilyKey = record.Geo__c + record.Product_Family__c + record.Service_Sub_Type__c + endUserCategory;
					  mapCustomerDiscount3GeoProductFamily[geoProductFamilyKey] = objValue;

					});

				  }
				  var remainingLines = [];
				  lines.forEach(function(line) {


					var countryProductLineKey = installAtCountry + line.record['Product_Line__c'] + line.record['HDSServiceSubType__c'] + endUserCategory;
					var regionProductLineKey = quoteRegion+ line.record['Product_Line__c'] + line.record['HDSServiceSubType__c'] + endUserCategory;
					var geoProductLineKey = quoteGeo + line.record['Product_Line__c'] + line.record['HDSServiceSubType__c'] + endUserCategory;
					var countryProductFamilyKey = installAtCountry + line.record['SBQQ__ProductFamily__c'] + line.record['HDSServiceSubType__c'] + endUserCategory;
					var regionProductFamilyKey = quoteRegion + line.record['SBQQ__ProductFamily__c'] + line.record['HDSServiceSubType__c'] + endUserCategory;
					var geoProductFamilyKey = quoteGeo + line.record['SBQQ__ProductFamily__c'] + line.record['HDSServiceSubType__c'] + endUserCategory;

					var obj;

					if (countryProductLineKey in mapCustomerDiscount3CountryProductLine) {
					  obj = mapCustomerDiscount3CountryProductLine[countryProductLineKey];
					}
					else if (regionProductLineKey in mapCustomerDiscount3RegionProductLine) {
					  obj = mapCustomerDiscount3RegionProductLine[regionProductLineKey];
					}
					else if (geoProductLineKey in mapCustomerDiscount3GeoProductLine) {
					  obj = mapCustomerDiscount3GeoProductLine[geoProductLineKey];
					}
					else if (countryProductFamilyKey in mapCustomerDiscount3CountryProductFamily) {
					  obj = mapCustomerDiscount3CountryProductFamily[countryProductFamilyKey];
					}
					else if (regionProductFamilyKey in mapCustomerDiscount3RegionProductFamily) {
					  obj = mapCustomerDiscount3RegionProductFamily[regionProductFamilyKey];
					}
					else if (geoProductFamilyKey in mapCustomerDiscount3GeoProductFamily) {
					  obj = mapCustomerDiscount3GeoProductFamily[geoProductFamilyKey];
					}

					if (obj) {
					  applyDiscountsOnLineItem(line, obj, 'Rule3');
					}
					else {
					  remainingLines.push(line);
					}
				  });
				  console.log('Remaining Lines after rule3:' + remainingLines.length);
				  //We will pass the remaining lines to the new set of rules 
				  if (remainingLines.length) {
					initCustomerDiscountRule4(remainingLines, conn, objQuote);
				  }

				});




			}

			// Customer Discount Rule 4
			//Match the remaining based on Product Family And End User Category (Assuming Service subtype is more granular than Product Family)
			//Rule 13 Match Install At Country, Product Family, Pricing Category, and End User Category
			//Rule 14 Match Region (1st occurrence of Region?), Product Family, Pricing Category, and End User Category
			//Rule 15 Match GEO, Product Family, Pricing Category, and End User Category
			function initCustomerDiscountRule4(lines, conn, objQuote) {
			  //This is the fourth customer discount rule which is just dependent on Services sub type
			  var pricingCategories = [];
			  var productFamilies = [];
			  var quoteGeo = objQuote.Geo__c;
			  var quoteRegion = objQuote.Region__c;
			  var quoteDistrict = objQuote.District__c;
			  
			  var endUserCategory = objQuote.End_User_Category__c;
			  var installAtCountry = objQuote.Install_At_Country__c;
				//Creating filter Sets
			  lines.forEach(function(line) {
				var pricingCategory = line.record['Product_Type__c'] ;
				var productFamily = line.record['SBQQ__ProductFamily__c'];
				if (productFamily && productFamilies.indexOf(productFamily) < 0) {
				  productFamilies.push(productFamily);
				}
				if (pricingCategory && pricingCategories.indexOf(pricingCategory) < 0) {
				  pricingCategories.push(pricingCategory);
				}
			  });
				//Creating Query
			  var customerSelectQuery = 'SELECT Id,Adjustment_Amount__c,Adjustment_Type__c,End_User_Category__c,Install_At_Country__c,Region__c,Geo__c,Product_Family__c,Pricing_Category__c FROM Lookup_Customer_Discount__c ';
			  var whereClause = " WHERE ";
			  var orConditions = '';

			  if (productFamilies.length) {
				var productFamilyList = "('" + productFamilies.join("', '") + "')";
				if (orConditions) {
				  orConditions = orConditions + ' OR ' + ' (Product_Family__c IN ' + productFamilyList + ')';
				}
				else {
				  orConditions = '  (Product_Family__c IN ' + productFamilyList + ')';
				}
				orConditions = '  (' + orConditions + ')';
			  }
			  if (pricingCategories.length) {
				var pricingCategoryList = "('" + pricingCategories.join("', '") + "')";
				if (orConditions) {
				  orConditions = orConditions + ' OR ' + ' (Pricing_Category__c IN ' + pricingCategoryList + ')';
				}
				else {
				  orConditions = '  (Pricing_Category__c IN ' + pricingCategoryList + ')';
				}
				orConditions = '  (' + orConditions + ')';
			  }


			  var query = customerSelectQuery + whereClause + orConditions;
			  var mapCustomerDiscount4Geo = {};
			  var mapCustomerDiscount4Country = {};
			  var mapCustomerDiscount4Region = {};

			  console.log('Customer discount rule 4:' + query);

				//Iterating over all the results that was queried for CustomerDiscount lookup and creating map
			  conn.query(query)
				.then(function(results) {
					logResultSize(results,query,'Customer discount rule 4');
				  if (results.totalSize) {
					results.records.forEach(function(record) {
					  
					  var objValue = createObjectValue(record);

					  var geoKey = record.Geo__c + record.Product_Family__c + record.End_User_Category__c + record.Pricing_Category__c;
					  mapCustomerDiscount4Geo[geoKey] = objValue;

					  var countryKey = record.Install_At_Country__c + record.Product_Family__c + record.End_User_Category__c + record.Pricing_Category__c;;
					  mapCustomerDiscount4Country[countryKey] = objValue;

					  var regionKey = record.Region__c + record.Product_Family__c + record.End_User_Category__c + record.Pricing_Category__c ;
					  mapCustomerDiscount4Region[regionKey] = objValue;



					});

				  }
				  var remainingLines = [];
				  lines.forEach(function(line) {
					  
					var countryKey = installAtCountry + line.record['SBQQ__ProductFamily__c'] + endUserCategory + line.record['Product_Type__c'];
					var regionKey = quoteRegion + line.record['SBQQ__ProductFamily__c'] + endUserCategory + line.record['Product_Type__c'];
					var geoKey = quoteGeo + line.record['SBQQ__ProductFamily__c'] + endUserCategory + line.record['Product_Type__c'] ;

					var obj;

					if (countryKey in mapCustomerDiscount4Country) {
					  obj = mapCustomerDiscount4Country[countryKey];
					}
					else if (regionKey in mapCustomerDiscount4Region) {
					  obj = mapCustomerDiscount4Region[regionKey];
					}
					else if (geoKey in mapCustomerDiscount4Geo) {
					  obj = mapCustomerDiscount4Geo[geoKey];
					}

					if (obj) {
					  applyDiscountsOnLineItem(line, obj, 'Rule4');
					}
					else {
					  remainingLines.push(line);
					}
				  });
				  console.log('We still have Remaining Lines after rule4:' + remainingLines.length);
					//AlL Customer Rules Applied

				});
			}

			
			function chainCustomerPartnerDiscountRules(lines,conn, objQuote, allLines){
				console.log('==============Chain Customer Discount and Partner Discount Rules after RAF Rules ===========');
				//Do_Not_Apply_Customer_Partner_Discount__c check on RCP
				if(isChainingDone == false){
					if(objQuote.Renewal_Contract_Package__r.Do_Not_Apply_Customer_Partner_Discount__c == false ){
						//Account Class Check on Quote, Direct =  Customer Discount, Indirect = Partner Discount
						if(objQuote.Account_Class__c == "Direct"){
							initCustomerDiscountRule1(allLines, conn, objQuote);
						}
						else{
							initPartnerDiscountRule1(allLines, conn, objQuote);
						}
						isChainingDone = true;
					}
				}
			}

			
			//Function to create customArrayObject passed into applyDiscountsOnLineItem function to apply discount
			//Structure :: Array
			//discount : discount to be applied
			//type : type of discount applied

			function logResultSize(record, query, ruleNo){
				console.log('Rule no. :: ' + ruleNo);
				console.log('Query :: ' + query);
				//console.log('Results :: ' + JSON.stringify(record));
				console.log('Results Size :: ' + JSON.stringify(record).length);
				console.log('No of Records :: ' + record.totalSize);
			}


			//Function to create customArrayObject passed into applyDiscountsOnLineItem function to apply discount
			//Structure :: Array
			//discount : discount to be applied
			//type : type of discount applied

			function createObjectValue(record){
				var objValue = {
					"discount": record.Adjustment_Amount__c,
					"type": record.Adjustment_Type__c
				  };
				return objValue;
			}

			//Apply DiscountOn QuoteLineItem
			//Parameters : Quoteline, CustomArrayObject, RuleNumber
			//CustomArrayObject Sturcture :: Array
			//discount : discount to be applied
			//type : type of discount applied
			function applyDiscountsOnLineItem(line, obj, ruleNumber) {
			  line.record['Partner_Discount_Adjustment_Amount__c'] = obj['discount'] || 0;
			  line.record['Partner_Discount_Applied__c'] = true;
			  line.record['Partner_Discount_Adjustment_Type__c'] = obj['type'];
			}
			
			//Apply DiscountOn QuoteLineItem for RAF
			//Parameters : Quoteline, CustomArrayObject, RuleNumber
			//CustomArrayObject Sturcture :: Array
			//discount : discount to be applied
			//type : type of discount applied
			function applyDiscountsOnLineItemRAF(line, obj, ruleNumber) {		
			  line.record['RAF_Adjustment_Amount__c'] = obj['discount'] || 0;
			  line.record['RAF_Applied__c'] = true;
			  line.record['RAF_Adjustment_Type__c'] = obj['type'];	
			}
			

			// Partner Discount Rule Function

			//Partner Discount Rule 1
			//Rule 1 Match Service Sub Type, End User Category, and VSOE Discount Category
			function initPartnerDiscountRule1(lines, conn, objQuote) {
			  //This is the first customer discount rule which is just dependent on VSOE Discount Category
			  console.log('Partner Rule 1 Entry :: Lines :: ' + lines.length);
			  var vsoeDiscountCategories = [];
			  var endUserCategories = objQuote.End_User_Category__c;
			  var serviceSubtypes = [];
			  //Creating filter
			  lines.forEach(function(line) {

				var vsoeDiscountCategory = line.record['VSOE_Discount__c'];
				var serviceSubtype = line.record['HDSServiceSubType__c'];
				
				if (vsoeDiscountCategory && vsoeDiscountCategories.indexOf(vsoeDiscountCategory) < 0) {
				  vsoeDiscountCategories.push(vsoeDiscountCategory);
				}
				if (serviceSubtype && serviceSubtypes.indexOf(vsoeDiscountCategory) < 0) {
				  serviceSubtypes.push(serviceSubtype);
				}
			  });

			  var customerSelectQuery = 'SELECT Id,Adjustment_Amount__c,Adjustment_Type__c,Service_Sub_Type__c,End_User_Category__c,VSOE_Discount_Category__c FROM Lookup_Partner_Discount__c ';
			  var whereClause = " WHERE ";

			  var orConditions = '';
			  if (vsoeDiscountCategories.length) {

				var vsoeDiscountList = "('" + vsoeDiscountCategories.join("', '") + "')";
				if (orConditions) {
				  orConditions = orConditions + ' AND ' + ' (VSOE_Discount_Category__c IN ' + vsoeDiscountList + ')';
				}
				else {
				  orConditions = '  (VSOE_Discount_Category__c IN ' + vsoeDiscountList + ')';
				}
				orConditions = '  (' + orConditions + ')';
			  }
			  if (serviceSubtypes.length) {

				var vserviceSubtypesList = "('" + serviceSubtypes.join("', '") + "')";
				if (orConditions) {
				  orConditions = orConditions + ' AND ' + ' (Service_Sub_Type__c IN ' + vserviceSubtypesList + ')';
				}
				else {
				  orConditions = '  (Service_Sub_Type__c IN ' + vserviceSubtypesList + ')';
				}
				orConditions = '  (' + orConditions + ')';
			  }
			  
			  //Creating Query
			  var query = customerSelectQuery;
			  if (orConditions) {
				query = query + whereClause + orConditions;
			  }
			  
			  if (endUserCategories) {
				  if(orConditions)
					query += " AND End_User_Category__c = '" + endUserCategories + "'";
				  else		
					query += " WHERE End_User_Category__c = '" + endUserCategories + "'";
			  }
			  
			  console.log('Partner Discount rule 1 Query : ' + query);
			  var mapCustomerDiscount1VSOE = {};
				
				//Iterating over all the results that was queried for PartnerDiscount lookup and creating map
			  conn.query(query)
				.then(function(results) {
					logResultSize(results,query,'Partner Discount rule 1');
				  if (results.totalSize) {

					results.records.forEach(function(record) {
					  
					  
					  var objValue = createObjectValue(record);
					  
					  var vsoeKey = record.Service_Sub_Type__c + record.VSOE_Discount_Category__c + record.End_User_Category__c;	
					  mapCustomerDiscount1VSOE[vsoeKey] = objValue

					});

				  }


				  var remainingLines = [];
				  lines.forEach(function(line) {
					var obj;
					var customerVSOEKey = line.record['HDSServiceSubType__c'] + line.record['VSOE_Discount__c'] + objQuote.End_User_Category__c;
					if (customerVSOEKey in mapCustomerDiscount1VSOE) {
					  console.log('Got Match :: ' + customerVSOEKey);
					  obj = mapCustomerDiscount1VSOE[customerVSOEKey];
					}

					if (obj) {
					  applyDiscountsOnLineItem(line, obj, 'Rule 1');
					}
					else {
					  remainingLines.push(line);
					}

				  });
				  console.log('Remaining Lines after rule 1: ' + remainingLines.length);

				  //We will pass the remaining lines to the new set of rules 
				  if (remainingLines.length) {
					console.log('PD Inside remaining lines: ');
					initPartnerDiscountRule2(remainingLines, conn, objQuote);
				  }

				});
				
			}


			//Partner Discount Rule 2
			//Match based on Bill To Account and Bill To Site
			//Rule 2 Match the product .p code to Bill To Account and Bill To Site
			//Rule 3 Match the Bill To Account, Bill To Site, Product Line, and Pricing Category
			//Rule 4 Match the Bill To Account, Bill To Site, Product Family, and Service Sub Type
			//Rule 5 Match the Bill To Account, Bill To Site, Product Family, and Pricing Category

			function initPartnerDiscountRule2(lines, conn, objQuote) {

				console.log('Partner Rule 2 Entry');
			  //This is the second customer discount rule 
			  var billToAccount = objQuote.Bill_To_Account__c;
			  var billToSite = objQuote.Bill_To_Account__r.SiteNumber__c;
			  console.log('Partner Discount Rule2: bill to Account :: ' + billToAccount + ', Bill to Site :: ' + billToSite);
			  
			  var customerSelectQuery = 'SELECT Id,Adjustment_Amount__c,Adjustment_Type__c,Service_Sub_Type__c,End_User_Category__c,Product_Family__c,Product_Line__c,Product__c,Bill_To_Account__c,Bill_To_Site__c,Pricing_Category__c FROM Lookup_Partner_Discount__c ';
			  var whereClause = " WHERE ";
			  var conditions;
			  
			  //Creating Filter Sets
			  if (billToAccount) {
				conditions = " Bill_To_Account__c  = '" + billToAccount + "'";
			  }
			  if (billToSite) {
				if (conditions) {
				  conditions += " AND Bill_To_Site__c ='" + billToSite + "'";
				}
				else {
				  conditions = "  Bill_To_Site__c ='" + billToSite + "'";
				}

			  }
			  //Creating Query
			  var query = customerSelectQuery;
			  if (conditions) {
				query = query + whereClause + conditions;
			  }
			  console.log('Partner Discount rule 2: Query' + query);

			  var mapCustomerDiscount2ProductPCode = {};
			  var mapCustomerDiscount2ProductLinePricingCategory = {};
			  var mapCustomerDiscount2ProductFamilySubType = {};
			  var mapCustomerDiscount2ProductFamilyPricingCategory = {};
			  
			  //Iterating over all the results that was queried for PartnerDiscount lookup and creating map
			  conn.query(query)
				.then(function(results) {
					logResultSize(results,query,'Partner Discount rule 2');
				  if (results.totalSize) {
					results.records.forEach(function(record) {
						
					  var objValue = createObjectValue(record);

					  var productCodeKey = record.Product__c + record.Bill_To_Account__c + record.Bill_To_Site__c;
					  mapCustomerDiscount2ProductPCode[productCodeKey] = objValue;

					  var productLinePricingCategoryKey = record.Bill_To_Account__c + record.Bill_To_Site__c + record.Product_Line__c + record.Pricing_Category__c;
					  mapCustomerDiscount2ProductLinePricingCategory[productLinePricingCategoryKey] = objValue;

					  var productFamilySubTypeKey = record.Bill_To_Account__c + record.Bill_To_Site__c + record.Product_Family__c + record.Service_Sub_Type__c;
					  mapCustomerDiscount2ProductFamilySubType[productFamilySubTypeKey] = objValue;

					  var productFamilyPricingCategoryKey = record.Bill_To_Account__c + record.Bill_To_Site__c + record.Product_Family__c + record.Pricing_Category__c;
					  mapCustomerDiscount2ProductFamilyPricingCategory[productFamilyPricingCategoryKey] = objValue;

					});
				  }
				
				  var remainingLines = [];
				  lines.forEach(function(line) {

					var productCodeKey = line.record['SBQQ__Product__c'] + billToAccount + billToSite;
					var productLinePricingCategoryKey = billToAccount + billToSite + line.record['Product_Line__c'] + line.record['Product_Type__c'];
					var productFamilySubTypeKey = billToAccount + billToSite + line.record['SBQQ__ProductFamily__c'] + line.record['HDSServiceSubType__c'];
					var productFamilyPricingCategoryKey = billToAccount + billToSite + line.record['SBQQ__ProductFamily__c'] + line.record['Product_Type__c'];

					var obj;

					if (productCodeKey in mapCustomerDiscount2ProductPCode) {
					  obj = mapCustomerDiscount2ProductPCode[productCodeKey];
					}
					else if (productLinePricingCategoryKey in mapCustomerDiscount2ProductLinePricingCategory) {
					  obj = mapCustomerDiscount2ProductLinePricingCategory[productLinePricingCategoryKey];
					}
					else if (productFamilySubTypeKey in mapCustomerDiscount2ProductFamilySubType) {
					  obj = mapCustomerDiscount2ProductFamilySubType[productFamilySubTypeKey];
					}
					else if (productFamilyPricingCategoryKey in mapCustomerDiscount2ProductFamilyPricingCategory) {
					  obj = mapCustomerDiscount2ProductFamilyPricingCategory[productFamilyPricingCategoryKey];
					}

					if (obj) {
					  applyDiscountsOnLineItem(line, obj, 'Rule2');
					}
					else {
					  remainingLines.push(line);
					}
				  });
				  
				  console.log('Remaining Lines after rule2:' + remainingLines.length);
				  //We will pass the remaining lines to the new set of rules 
				  if (remainingLines.length) {
					  console.log('Calling rule 3 :: with ' + remainingLines.length);
					initPartnerDiscountRule3(remainingLines, conn, objQuote);
				  }

				});

			}

			//Partner Discount Rule 3
			//Match based on Product Family, Service Sub Type, and Partner Level
			//Rule 6 Match Install At Country, Product Family, Service Sub Type, and Partner Level
			//Rule 7 Match District (1st occurrence of District?), Product Family, Service Sub Type, and Partner Level
			//Rule 8 Match Region (1st occurrence of Region?), Product Family, Service Sub Type, and Partner Level
			//Rule 9 Match GEO, Product Family, Service Sub Type, and Partner Level

			function initPartnerDiscountRule3(lines, conn, objQuote) {
			  //This is the third customer discount rule which is just dependent on Product Family, Service Sub Type, and Partner Level
			  console.log('Partner rule Entry Rule 3 >> ');
			  
			  var productFamily = [];
			  var subTypes = [];
			  var partnerLevel = objQuote.Partner_Level__c;
			  var installAtCountry = objQuote.Install_At_Country__c;
			  var quoteGeo = objQuote.Geo__c;
			  var quoteRegion = objQuote.Region__c;
			  var quoteDistrict = objQuote.District__c;
			  
			  lines.forEach(function(line) {
				var subType = line.record['HDSServiceSubType__c'];
				var productF = line.record['SBQQ__ProductFamily__c'];
				if (subType && subTypes.indexOf(subType) < 0) {
				  subTypes.push(subType);
				}
				if (productF && productFamily.indexOf(productF) < 0) {
				  productFamily.push(productF);
				}
			  });

			  var customerSelectQuery = 'SELECT Id,Program_Level__c,Adjustment_Amount__c,Adjustment_Type__c,Service_Sub_Type__c,End_User_Category__c,Install_At_Country__c,Region__c,Geo__c,District__c,Product_Family__c,Product_Line__c FROM Lookup_Partner_Discount__c ';
			  var whereClause = " WHERE ";
				//Creating Filter Sets
			  var orConditions = '';
			  if (subTypes.length) {

				var subTypeList = "('" + subTypes.join("', '") + "')";
				if (orConditions) {
				  orConditions = orConditions + ' AND ' + ' (Service_Sub_Type__c IN ' + subTypeList + ')';
				}
				else {
				  orConditions = '  (Service_Sub_Type__c IN ' + subTypeList + ')';
				}
				orConditions = '  (' + orConditions + ')';

			  }
			  
			  if (productFamily.length) {

				var productFamilyList = "('" + productFamily.join("', '") + "')";
				if (orConditions) {
				  orConditions = orConditions + ' AND ' + ' (Product_Family__c IN ' + productFamilyList + ')';
				}
				else {
				  orConditions = '  (Product_Family__c IN ' + productFamilyList + ')';
				}
				orConditions = '  (' + orConditions + ')';

			  }
			  
			  var query = customerSelectQuery + whereClause + orConditions;
			  if (partnerLevel) {
				query += " AND Program_Level__c = '" + partnerLevel + "'";
			  }
			  console.log('Partner discount rule 3: Query' + query);

			  var mapCustomerDiscount3Country = {};
			  var mapCustomerDiscount3Distict = {};
			  var mapCustomerDiscount3Region = {};
			  var mapCustomerDiscount3Geo= {};

			  //Iterating over all the results that was queried for PartnerDiscount lookup and creating map
			  conn.query(query)
				.then(function(results) {
					logResultSize(results,query,'Partner Discount rule 3');
				  if (results.totalSize) {
					results.records.forEach(function(record) {
					  
					  var objValue = createObjectValue(record);

					  var countryKey = record.Install_At_Country__c + record.Product_Family__c + record.Service_Sub_Type__c + record.Program_Level__c;
					  mapCustomerDiscount3Country[countryKey] = objValue;

					  var districtKey = record.District__c + record.Product_Family__c + record.Service_Sub_Type__c + record.Program_Level__c;
					  mapCustomerDiscount3Distict[districtKey] = objValue;
					  
					  var regionKey = record.Region__c + record.Product_Family__c + record.Service_Sub_Type__c + record.Program_Level__c;
					  mapCustomerDiscount3Region[regionKey] = objValue;
					  
					  var geoKey = record.Geo__c + record.Product_Family__c + record.Service_Sub_Type__c + record.Program_Level__c;
					  mapCustomerDiscount3Geo[geoKey] = objValue;

					});

				  }
				  var remainingLines = [];
				  lines.forEach(function(line) {
					var countryKey = installAtCountry + line.record['SBQQ__ProductFamily__c'] + line.record['HDSServiceSubType__c'] + partnerLevel;
					var regionKey = quoteRegion + line.record['SBQQ__ProductFamily__c'] + line.record['HDSServiceSubType__c'] + partnerLevel;
					var districtKey = quoteDistrict + line.record['SBQQ__ProductFamily__c'] + line.record['HDSServiceSubType__c'] + partnerLevel;
					var geoKey = quoteGeo + line.record['SBQQ__ProductFamily__c'] + line.record['HDSServiceSubType__c'] + partnerLevel;
					
					var obj;

					if (countryKey in mapCustomerDiscount3Country) {
					  obj = mapCustomerDiscount3Country[countryKey];
					}
					else if (regionKey in mapCustomerDiscount3Region) {
					  obj = mapCustomerDiscount3Region[regionKey];
					}
					else if (geoKey in mapCustomerDiscount3Geo) {
					  obj = mapCustomerDiscount3Geo[geoKey];
					}
					else if (districtKey in mapCustomerDiscount3Distict) {
					  obj = mapCustomerDiscount3Distict[districtKey];
					}

					if (obj) {
					  applyDiscountsOnLineItem(line, obj, 'Rule 3');
					}
					else {
					  remainingLines.push(line);
					}
				  });
				  console.log('Remaining Lines after rule 3 :: ' + remainingLines.length);
				  //We will pass the remaining lines to the new set of rules 
				  if (remainingLines.length) {
					  console.log('Calling rule 4 :: with ' + remainingLines.length);
					initPartnerDiscountRule4(remainingLines, conn, objQuote);
				  }

				});
			}

			//Partner Discount Rule 4
			//Match based on Product Family, Pricing Category, and Partner Level
			//Rule 10 Match District (1st occurrence of District?), Product Family, Pricing Category, and Partner Level
			//Rule 11 Match Region (1st occurrence of Region?), Product Family, Pricing Category, and Partner Level
			//Rule 12 Match GEO, Product Family, Pricing Category, and Partner Level

			function initPartnerDiscountRule4(lines, conn, objQuote) {
			  //This is the Fourth customer discount rule which is just dependent on Product Family, Service Sub Type, and Partner Level
			  console.log('Partner rule Entry Rule 4 >> ' + lines.length);
			  var productFamily = [];
			  var pricingCategory = [];
			  var partnerLevel = objQuote.Partner_Level__c;
			  var installAtCountry = objQuote.Install_At_Country__c;
			  var quoteGeo = objQuote.Geo__c;
			  var quoteRegion = objQuote.Region__c;
			  var quoteDistrict = objQuote.District__c;
			  
			  //Creating Filter Sets
			  lines.forEach(function(line) {
				var productF = line.record['SBQQ__ProductFamily__c'];
				var pricingCat = line.record['Product_Type__c'];
				if (pricingCat && pricingCategory.indexOf(pricingCat) < 0) {
				  pricingCategory.push(pricingCat);
				}	
				if (productF && productFamily.indexOf(productF) < 0) {
				  productFamily.push(productF);
				}
			  });
				 
			  var customerSelectQuery = 'SELECT Id,Pricing_Category__c,Program_Level__c,Adjustment_Amount__c,Adjustment_Type__c,Service_Sub_Type__c,End_User_Category__c,Install_At_Country__c,Region__c,Geo__c,District__c,Product_Family__c,Product_Line__c FROM Lookup_Partner_Discount__c ';
			  var whereClause = " WHERE ";
				 
			  var orConditions = '';
			  if (pricingCategory.length) {

				var pricingCategoryList = "('" + pricingCategory.join("', '") + "')";
				if (orConditions) {
				  orConditions = orConditions + ' AND ' + ' (Pricing_Category__c IN ' + pricingCategoryList + ')';
				}
				else {
				  orConditions = '  (Pricing_Category__c IN ' + pricingCategoryList + ')';
				}
				orConditions = '  (' + orConditions + ')';

			  }  
				 
			  if (productFamily.length) {

				var productFamilyList = "('" + productFamily.join("', '") + "')";
				if (orConditions) {
				  orConditions = orConditions + ' AND ' + ' (Product_Family__c IN ' + productFamilyList + ')';
				}
				else {
				  orConditions = '  (Product_Family__c IN ' + productFamilyList + ')';
				}
				orConditions = '  (' + orConditions + ')';

			  }
			  
				//Creating Query
			  var query = customerSelectQuery + whereClause + orConditions;
			  if (partnerLevel) {
				query += " AND Program_Level__c = '" + partnerLevel + "'";
			  }
			  console.log('Partner discount rule 4: Query' + query);

			  var mapCustomerDiscount3Distict = {};
			  var mapCustomerDiscount3Region = {};
			  var mapCustomerDiscount3Geo= {};

				//Iterating over all the results that was queried for PartnerDiscount lookup and creating map
			  conn.query(query)
				.then(function(results) {
					logResultSize(results,query,'Partner Discount rule 4');
				  if (results.totalSize) {
					results.records.forEach(function(record) {
					  
					  var objValue = createObjectValue(record);

					  var districtKey = record.District__c + record.Product_Family__c + record.Pricing_Category__c + record.Program_Level__c;
					  mapCustomerDiscount3Distict[districtKey] = objValue;
					  
					  var regionKey = record.Region__c + record.Product_Family__c + record.Pricing_Category__c + record.Program_Level__c;
					  mapCustomerDiscount3Region[regionKey] = objValue;
					  
					  var geoKey = record.Geo__c + record.Product_Family__c + record.Pricing_Category__c + record.Program_Level__c;
					  mapCustomerDiscount3Geo[geoKey] = objValue;

					});

				  }
				 
				  var remainingLines = [];
				  lines.forEach(function(line) {


					var regionKey = quoteRegion + line.record['SBQQ__ProductFamily__c'] + line.record['Product_Type__c'] + partnerLevel;
					var districtKey = quoteDistrict + line.record['SBQQ__ProductFamily__c'] + line.record['Product_Type__c'] + partnerLevel;
					var geoKey = quoteGeo + line.record['SBQQ__ProductFamily__c'] + line.record['Product_Type__c'] + partnerLevel;
					
					var obj;

					if (regionKey in mapCustomerDiscount3Region) {
					  obj = mapCustomerDiscount3Region[regionKey];
					}
					else if (geoKey in mapCustomerDiscount3Geo) {
					  obj = mapCustomerDiscount3Geo[geoKey];
					}
					else if (districtKey in mapCustomerDiscount3Distict) {
					  obj = mapCustomerDiscount3Distict[districtKey];
					}

					if (obj) {
					  applyDiscountsOnLineItem(line, obj, 'Rule 4');
					}
					else {
					  remainingLines.push(line);
					}
				  });
				  console.log('Remaining Lines after rule 4:' + remainingLines.length);
				  //We will pass the remaining lines to the new set of rules 
				  if (remainingLines.length) {
					  console.log('Calling rule 5 :: with ' + remainingLines.length);
					initPartnerDiscountRule5(remainingLines, conn, objQuote);
				  }

				});
			}

			//Partner Discount Rule 5
			//Match based on Product Family, Service Sub Type, and Partner Service Capability
			//Rule 13 Match Install At Country, Product Family, Service Sub Type, and Partner Service Capability
			//Rule 14 Match District (1st occurrence of District?), Product Family, Service Sub Type, and Partner Service Capability
			//Rule 15 Match Region (1st occurrence of Region?), Product Family, Service Sub Type, and Partner Service Capability
			//Rule 16 Match GEO, Product Family, Service Sub Type, and Partner Service Capability
			function initPartnerDiscountRule5(lines, conn, objQuote) {
			  //This is the third customer discount rule which is just dependent on Product Family, Service Sub Type, and Partner Level
			  console.log('Partner rule Entry Rule 5 >> ' + lines.length);
			  
			  var productFamily = [];
			  var subTypes = [];
			  var partnerServiceCapablity = objQuote.Partner_Service_Capability__c;
			  var installAtCountry = objQuote.Install_At_Country__c;
			  var quoteGeo = objQuote.Geo__c;
			  var quoteRegion = objQuote.Region__c;
			  var quoteDistrict = objQuote.District__c;
			  //Creating Filter Set
			  lines.forEach(function(line) {
				var subType = line.record['HDSServiceSubType__c'];
				var productF = line.record['SBQQ__ProductFamily__c'];
				if (subType && subTypes.indexOf(subType) < 0) {
				  subTypes.push(subType);
				}
				if (productF && productFamily.indexOf(productF) < 0) {
				  productFamily.push(productF);
				}
			  });

			  var customerSelectQuery = 'SELECT Id,Program_Level__c,Adjustment_Amount__c,Adjustment_Type__c,Service_Sub_Type__c,End_User_Category__c,Install_At_Country__c,Region__c,Geo__c,District__c,Product_Family__c,Product_Line__c FROM Lookup_Partner_Discount__c ';
			  var whereClause = " WHERE ";

			  var orConditions = '';
			  if (subTypes.length) {

				var subTypeList = "('" + subTypes.join("', '") + "')";
				if (orConditions) {
				  orConditions = orConditions + ' AND ' + ' (Service_Sub_Type__c IN ' + subTypeList + ')';
				}
				else {
				  orConditions = '  (Service_Sub_Type__c IN ' + subTypeList + ')';
				}
				orConditions = '  (' + orConditions + ')';

			  }
			  
			  if (productFamily.length) {

				var productFamilyList = "('" + productFamily.join("', '") + "')";
				if (orConditions) {
				  orConditions = orConditions + ' AND ' + ' (Product_Family__c IN ' + productFamilyList + ')';
				}
				else {
				  orConditions = '  (Product_Family__c IN ' + productFamilyList + ')';
				}
				orConditions = '  (' + orConditions + ')';

			  }
			  //Creating Query
			  var query = customerSelectQuery + whereClause + orConditions;
			  if (partnerServiceCapablity) {
				query += " AND Partner_Service_Capability__c = '" + partnerServiceCapablity + "'";
			  }
			  console.log('Partner discount rule 3:' + query);

			  var mapCustomerDiscount5Country = {};
			  var mapCustomerDiscount5Distict = {};
			  var mapCustomerDiscount5Region = {};
			  var mapCustomerDiscount5Geo= {};

				//Iterating over all the results that was queried for PartnerDiscount lookup and creating map
			  conn.query(query)
				.then(function(results) {
					logResultSize(results,query,'Partner Discount rule 5');
				  if (results.totalSize) {
					results.records.forEach(function(record) {
					  
					  var objValue = createObjectValue(record);
					  var countryKey = record.Install_At_Country__c + record.Product_Family__c + record.Service_Sub_Type__c + record.Partner_Service_Capability__c;
					  mapCustomerDiscount5Country[countryKey] = objValue;

					  var districtKey = record.District__c + record.Product_Family__c + record.Service_Sub_Type__c + record.Partner_Service_Capability__c;
					  mapCustomerDiscount5Distict[districtKey] = objValue;
					  
					  var regionKey = record.Region__c + record.Product_Family__c + record.Service_Sub_Type__c + record.Partner_Service_Capability__c;
					  mapCustomerDiscount5Region[regionKey] = objValue;
					  
					  var geoKey = record.Geo__c + record.Product_Family__c + record.Service_Sub_Type__c + record.Partner_Service_Capability__c;
					  mapCustomerDiscount5Geo[geoKey] = objValue;

					});

				  }
				  var remainingLines = [];
				  lines.forEach(function(line) {


					var countryKey = installAtCountry + line.record['SBQQ__ProductFamily__c'] + line.record['HDSServiceSubType__c'] + partnerServiceCapablity;
					var regionKey = quoteRegion + line.record['SBQQ__ProductFamily__c'] + line.record['HDSServiceSubType__c'] + partnerServiceCapablity;
					var districtKey = quoteDistrict + line.record['SBQQ__ProductFamily__c'] + line.record['HDSServiceSubType__c'] + partnerServiceCapablity;
					var geoKey = quoteGeo + line.record['SBQQ__ProductFamily__c'] + line.record['HDSServiceSubType__c'] + partnerServiceCapablity;
					
					var obj;

					if (countryKey in mapCustomerDiscount5Country) {
					  obj = mapCustomerDiscount5Country[countryKey];
					}
					else if (regionKey in mapCustomerDiscount5Region) {
					  obj = mapCustomerDiscount5Region[regionKey];
					}
					else if (geoKey in mapCustomerDiscount5Geo) {
					  obj = mapCustomerDiscount5Geo[geoKey];
					}
					else if (districtKey in mapCustomerDiscount5Distict) {
					  obj = mapCustomerDiscount5Distict[districtKey];
					}

					if (obj) {
					  applyDiscountsOnLineItem(line, obj, 'Rule 5');
					}
					else {
					  remainingLines.push(line);
					}
				  });
				  console.log('Remaining Lines after rule 5:' + remainingLines.length);
				  //We will pass the remaining lines to the new set of rules 
				  if (remainingLines.length) {
					  console.log('Calling rule 6 :: with ' + remainingLines.length);
					initPartnerDiscountRule6(remainingLines, conn, objQuote);
				  }

				});
			}

			//Partner Discount Rule 5
			//Match based on Product Family, Pricing Category, and Service Model
			//Rule 17 Match Install At Country, Product Family, Pricing Category, and Service Model
			//Rule 18 Match District (1st occurrence of District?), Product Family, Pricing Category, and Service Model
			//Rule 19 Match Region (1st occurrence of Region?), Product Family, Pricing Category, and Service Model
			//Rule 20 Match GEO, Product Family, Pricing Category, and Service Model
			function initPartnerDiscountRule6(lines, conn, objQuote) {
			  //This is the Fourth customer discount rule which is just dependent on Product Family, Service Sub Type, and Partner Level
			  console.log('Partner rule Entry Rule 6 >> ' + lines.length);
			  var productFamily = [];
			  var pricingCategory = [];
			  var serviceModals = [];
			  var installAtCountry = objQuote.Install_At_Country__c;
			  var quoteGeo = objQuote.Geo__c;
			  var quoteRegion = objQuote.Region__c;
			  var quoteDistrict = objQuote.District__c;
			  //Creating Filter Sets
			  lines.forEach(function(line) {
				var productF = line.record['SBQQ__ProductFamily__c'];
				var pricingCat = line.record['Product_Type__c'];
				var serviceM = line.record['Service_Model__c'];
				if (serviceM && serviceModals.indexOf(serviceM) < 0) {
				  serviceModals.push(serviceM);
				}
				if (pricingCat && pricingCategory.indexOf(pricingCat) < 0) {
				  pricingCategory.push(pricingCat);
				}	
				if (productF && productFamily.indexOf(productF) < 0) {
				  productFamily.push(productF);
				}
			  });
				//Creating Query
			  var customerSelectQuery = 'SELECT Id,Pricing_Category__c,Program_Level__c,Adjustment_Amount__c,Adjustment_Type__c,Service_Sub_Type__c,End_User_Category__c,Install_At_Country__c,Region__c,Geo__c,District__c,Product_Family__c,Product_Line__c FROM Lookup_Partner_Discount__c ';
			  var whereClause = " WHERE ";

			  var orConditions = '';
			  if (pricingCategory.length) {

				var pricingCategoryList = "('" + pricingCategory.join("', '") + "')";
				if (orConditions) {
				  orConditions = orConditions + ' AND ' + ' (Pricing_Category__c IN ' + pricingCategoryList + ')';
				}
				else {
				  orConditions = '  (Pricing_Category__c IN ' + pricingCategoryList + ')';
				}
				orConditions = '  (' + orConditions + ')';

			  }
			  
			  if (productFamily.length) {

				var productFamilyList = "('" + productFamily.join("', '") + "')";
				if (orConditions) {
				  orConditions = orConditions + ' AND ' + ' (Product_Family__c IN ' + productFamilyList + ')';
				}
				else {
				  orConditions = '  (Product_Family__c IN ' + productFamilyList + ')';
				}
				orConditions = '  (' + orConditions + ')';

			  }
			  
			  if (serviceModals.length) {

				var serviceModalsList = "('" + serviceModals.join("', '") + "')";
				if (orConditions) {
				  orConditions = orConditions + ' AND ' + ' (Service_Model__c IN ' + serviceModalsList + ')';
				}
				else {
				  orConditions = '  (Service_Model__c IN ' + serviceModalsList + ')';
				}
				orConditions = '  (' + orConditions + ')';

			  }
			  
			  var query = customerSelectQuery + whereClause + orConditions;
			  
			  console.log('Partner discount rule 6: Query' + query);

			  var mapCustomerDiscount6Country = {};
			  var mapCustomerDiscount6Distict = {};
			  var mapCustomerDiscount6Region = {};
			  var mapCustomerDiscount6Geo= {};

				//Iterating over all the results that was queried for PartnerDiscount lookup and creating map
			  conn.query(query)
				.then(function(results) {
					logResultSize(results,query,'Partner Discount rule 6');
				  if (results.totalSize) {
					results.records.forEach(function(record) {
					  var objValue = createObjectValue(record);
						
					  var countryKey = record.Install_At_Country__c + record.Product_Family__c + record.Pricing_Category__c + record.Service_Model__c;
					  mapCustomerDiscount6Country[countryKey] = objValue;
					  
					  var DistrictKey = record.District__c + record.Product_Family__c + record.Pricing_Category__c + record.Service_Model__c;
					  mapCustomerDiscount6Distict[countryKey] = objValue;
					  
					  var regionKey = record.Region__c + record.Product_Family__c + record.Pricing_Category__c + record.Service_Model__c;
					  mapCustomerDiscount6Region[regionKey] = objValue;
					  
					  var geoKey = record.Geo__c + record.Product_Family__c + record.Pricing_Category__c + record.Service_Model__c;
					  mapCustomerDiscount6Geo[geoKey] = objValue;

					});

				  }
				  var remainingLines = [];
				  lines.forEach(function(line) {

					var countryKey = installAtCountry + line.record['SBQQ__ProductFamily__c'] + line.record['Product_Type__c'] + line.record['Service_Model__c'];
					var regionKey = quoteRegion + line.record['SBQQ__ProductFamily__c'] + line.record['Product_Type__c'] + line.record['Service_Model__c'];
					var districtKey = quoteDistrict + line.record['SBQQ__ProductFamily__c'] + line.record['Product_Type__c'] + line.record['Service_Model__c'];
					var geoKey = quoteGeo + line.record['SBQQ__ProductFamily__c'] + line.record['Product_Type__c'] + line.record['Service_Model__c'];
					
					var obj;

					if (countryKey in mapCustomerDiscount6Country) {
					  obj = mapCustomerDiscount6Country[countryKey];
					}
					else if (regionKey in mapCustomerDiscount6Region) {
					  obj = mapCustomerDiscount6Region[regionKey];
					}
					else if (geoKey in mapCustomerDiscount6Geo) {
					  obj = mapCustomerDiscount6Geo[geoKey];
					}
					else if (districtKey in mapCustomerDiscount6Distict) {
					  obj = mapCustomerDiscount6Distict[districtKey];
					}

					if (obj) {
					  applyDiscountsOnLineItem(line, obj, 'Rule 6');
					}
					else {
					  remainingLines.push(line);
					}
				  });
				  console.log('We still have lines remaining after rule 6 :: ' + remainingLines.length);
				  
				  //All Partner Discount Rules applied
				});
				
				
				
			}