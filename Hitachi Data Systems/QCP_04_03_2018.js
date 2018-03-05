//QCP Code  
const WILDCARD_All = 'ALL';
var dateCondition = ''; 
 
//init Function 
export function onInit(lines, conn) { 

return Promise.resolve(); 
}; 



export function onBeforePriceRules(quote, lines, conn) { 
	return queryQuote(quote, lines,conn)
	.then(function(result){ 
		//This is partner/customer chaining 
		var lines = result.lines;
		var conn =  result.conn;
		var objQuote = result.objQuote;
		console.log('==============Chain Customer Discount and Partner Discount Rules after RAF Rules ==========='); 
		//Do_Not_Apply_Customer_Partner_Discount__c check on RCP 
		if(objQuote.Renewal_Contract_Package__r.Do_Not_Apply_Customer_Partner_Discount__c == false ){ 
		//Account Class Check on Quote, Direct = Customer Discount, Indirect = Partner Discount 
			if(objQuote.Account_Class__c!=null){ 
				if(objQuote.Account_Class__c.toUpperCase() == "DIRECT"){ 
					return initCustomerDiscountRule1(lines, conn, objQuote); 
				} 
				else{ 
					return initPartnerDiscountRule1(lines, conn, objQuote); 
				} 

				
			} 
		}else{
			return Promise.resolve();
		} 
	}); 

}; 

export function onBeforeCalculate(quote, lines,conn) { 
	return queryQuote(quote, lines,conn)
	.then(function(result){ 
		//This is first raf 
		return initRAFDiscountRule1(result); 
	});

}; 
/*export function onAfterCalculate(quoteModel, lines) { 
};*/ 

export function onAfterCalculate(quote, lineModels) {

console.log('On after calculate>>>');	
if (lineModels != null) { 
	lineModels.forEach(function(line) { 
	var effectiveTerm = getEffectiveSubscriptionTerm(quote, line); 
	line.record["Effective_Term__c"] = effectiveTerm; 
	var effectiveEndDate = calculateEndDate(quote, line); 
	line.record["Effective_End_Date__c"] = effectiveEndDate.valueOf(); 

	}); 
} 

return Promise.resolve(); 
} 

function queryQuote(quote, lines,conn){
	var allLines = lines; 
	//Null lines check 
	if (lines != null && lines.length > 0) { 

		var quoteId = lines[0].record['SBQQ__Quote__c'];  
		if(quoteId == null){ 
			quoteId = quote.record['Id']; 
			console.log('quote id from quote object:'+quoteId); 
		}else{
			console.log('Quote id from quote lines'+quoteId);
		}

		//Query SBQQ__Quote__c 
		var query = "SELECT Id,Partner_Level__c,Price_Date__c,Renewal_Contract_Package__r.Do_Not_Apply_Customer_Partner_Discount__c , Partner_Service_Capability__c,Account_Class__c,Geo__c,Region__c, District__c, Install_At_Country__c,SBQQ__BillingCountry__c,Bill_To_Account__c,Bill_To_Account__r.SiteNumber__c,End_User_Category__c FROM SBQQ__Quote__c WHERE Id ='" + quoteId + "' LIMIT 1"; 
		console.log(query); 
		/* 
		* conn.query() returns a Promise that resolves when the query completes. 
		* refrence :: https://community.steelbrick.com/t5/Developer-Guidebook/JS-Quote-Calculator-Plugin-Template-amp-Samples/ta-p/5787 
		*/ 

		return conn.query(query).then(function(results) { 
			if (results.totalSize) { 
			console.log('Results from query:'+results.records); 
			var objQuote = results.records[0]; 
			if(objQuote.Price_Date__c!=null){ 
			dateCondition = '(	Date_From__c <= ' + objQuote.Price_Date__c + ' AND Date_To__c >='+ objQuote.Price_Date__c +' )' ;
			} 
			var result = {"lines":lines,"conn":conn,"objQuote":objQuote}; 
			return result; 
			//Calling RAF Discount Function 
			} 
		}); 


	}
	return Promise.resolve();
}

function getEffectiveSubscriptionTerm(quote, line) { 
var startd = line.record["SBQQ__EffectiveStartDate__c"]; 
var endd = line.record["SBQQ__EffectiveEndDate__c"]; 
var sd = new Date(startd); 
var ed = new Date(endd); 
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
var ed = new Date(endd); 
if (startd != null && endd == null) { 
ed = sd; 
ed.setUTCMonth(ed.getUTCMonth() + getEffectiveSubscriptionTerm(quote, line)); 
ed.setUTCDate(ed.getUTCDate() - 1); 
endd = ed; 
} 
return endd; 
} 

function monthsBetween(startDate, endDate) { 
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

function initRAFDiscountRule1(result){ 
var lines = result.lines; 
console.log('lines from initRAFDiscountRule1'+lines); 
console.log('result:'+result); 
var conn = result.conn; 
var objQuote = result.objQuote; 
var allLines = result.allLines; 
var productPcodeSet = []; 
var quoteInstallAtCountry = objQuote.Install_At_Country__c; 
var quoteGeo = objQuote.Geo__c; 
var quoteRegion = objQuote.Region__c; 
var quoteDistrict = objQuote.District__c; 

lines.forEach(function(line) { 
var productPCode = line.record['Pricing_Product__c']; 
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
if(dateCondition){ 
if(andConditions){ 
andConditions+=' AND '; 
} 
andConditions += dateCondition; 
} 

if(andConditions){ 
andConditions+=' AND '; 
} 
andConditions += ' Product__c!=null '; 

if(andConditions) 
rafSelectQuery = rafSelectQuery + whereClause + andConditions; 
console.log('RAF discount rule 1:' + rafSelectQuery); 
var mapRAFProdcutCodeInstallAtCountry = {}; 
var mapRAFProdcutCodeRegion = {}; 
var mapRAFProdcutCodeGeo = {}; 
var a = 0; 
rafSelectQuery = rafSelectQuery + ' LIMIT 50000';
return conn.query(rafSelectQuery) 
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

//Initialize RAF_Logs__c field on QLI with default String 
line.record['RAF_Logs__c'] = 'No RAF Discount Applied, No match found in Table'; 
line.record['RAF_Adjustment_Amount__c'] = null; 
line.record['RAF_Applied__c'] = false; 
line.record['RAF_Adjustment_Type__c'] = null; 

var obj; 
var log = ''; 
var installAtCountryKey = quoteInstallAtCountry + line.record['Pricing_Product__c']; 
var regionKey = quoteRegion + line.record['Pricing_Product__c']; 
var geoKey = quoteGeo + line.record['Pricing_Product__c']; 

if (installAtCountryKey in mapRAFProdcutCodeInstallAtCountry) { 
obj = mapRAFProdcutCodeInstallAtCountry[installAtCountryKey]; 
log = 'Chunk 1 Rule 1 Applied [ Install At Country = ' + quoteInstallAtCountry + ' Product P Code = ' + line.record['Pricing_Product__c']+' ]'; 
}else if (regionKey in mapRAFProdcutCodeRegion) { 
obj = mapRAFProdcutCodeRegion[regionKey]; 
log = 'Chunk 1 Rule 2 Applied [ Region = ' + quoteRegion + ' Product P Code = ' + line.record['Pricing_Product__c']+' ]'; 
} 
else if (geoKey in mapRAFProdcutCodeGeo) { 
obj = mapRAFProdcutCodeGeo[geoKey]; 
log = 'Chunk 1 Rule 3 Applied [ Geo = ' + quoteGeo + ' Product P Code = ' + line.record['Pricing_Product__c']+' ]'; 
} 

if (obj) { 
applyDiscountsOnLineItemRAF(line, obj,'RAF Rule 1' ,log); 
} 
else { 
remainingLines.push(line); 
} 

}); 
console.log('Remaining Lines after RAF rule1:' + remainingLines.length); 

var result = {"remainingLines":remainingLines,"conn":conn,"objQuote":objQuote}; 
return result; 

}).then(function(result){ 
//We will use output of raf1 here 
//We will pass the remaining lines to the new set of rules 
if (result.remainingLines) { 
	return initRAFDiscountRule2(result.remainingLines, result.conn, result.objQuote); 
}else{ 
	return Promise.resolve();
} 
}); 
} 

//RAF Discount Rule 1 
//Rule 1 :: Match product Family, Product Category and installAtCountry 
//Rule 2 :: Match product Family, Product Category and Region 
//Rule 3 :: Match product Family, Product Category and Geo 

function initRAFDiscountRule2(lines,conn, objQuote){ 
var productFamilySet = []; 
var productCategorySet = []; 
var quoteInstallAtCountry = objQuote.Install_At_Country__c; 
var quoteGeo = objQuote.Geo__c; 
var quoteRegion = objQuote.Region__c; 
var quoteDistrict = objQuote.District__c; 

lines.forEach(function(line) { 
var productFamily = line.record['Pricing_Product_Family__c']; 
var productCategory = line.record['Product_Type__c']; 
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

andConditions = andConditions + ' (Product_Family__c IN ' + productFamilyList + ')'; 
} 

if(productCategorySet.length){ 
var productCategoryList = "('" + productCategorySet.join("', '") + "')"; 

if(andConditions) 
andConditions = andConditions + ' AND '; 

andConditions = andConditions + ' (Pricing_Category__c IN ' + productCategoryList + ')'; 
} 
if(dateCondition){ 
if(andConditions){ 
andConditions+=' AND '; 
} 
andConditions += dateCondition; 
} 

if(andConditions){ 
andConditions+=' AND '; 
} 
andConditions += ' Pricing_Category__c!=null AND Product_Family__c!=null '; 

if(andConditions) 
rafSelectQuery = rafSelectQuery + whereClause + andConditions; 

console.log('RAF discount rule 2:' + rafSelectQuery); 
var mapRAFProdcutFamilyCategoryInstallAtCountry = {}; 
var mapRAFProdcutFamilyCategoryRegion = {}; 
var mapRAFProdcutFamilyCategoryGeo = {}; 
rafSelectQuery = rafSelectQuery + ' LIMIT 50000';
return conn.query(rafSelectQuery) 
.then(function(results) {	
logResultSize(results,rafSelectQuery,'RAF discount rule 2'); 
if (results.totalSize) { 
results.records.forEach(function(record) { 
var objValue = createObjectValue(record); 
var installAtCountryKey = record.Install_At_Country__c + record.Product_Family__c + record.Pricing_Category__c; 
mapRAFProdcutFamilyCategoryInstallAtCountry[installAtCountryKey] = objValue; 
var regionKey = record.Region__c + record.Product_Family__c + record.Pricing_Category__c; 
mapRAFProdcutFamilyCategoryRegion[regionKey] = objValue; 
var geoKey = record.Geo__c +record.Product_Family__c + record.Pricing_Category__c; 
mapRAFProdcutFamilyCategoryGeo[geoKey] = objValue; 
}); 
} 
var remainingLines = []; 
lines.forEach(function(line) { 
var log = ''; 
var obj; 
var installAtCountryKey = quoteInstallAtCountry + line.record['Pricing_Product_Family__c'] + line.record['Product_Type__c']; 
var regionKey = quoteRegion + line.record['Pricing_Product_Family__c'] + line.record['Product_Type__c']; 
var geoKey = quoteGeo + line.record['Pricing_Product_Family__c'] + line.record['Product_Type__c']; 
if (installAtCountryKey in mapRAFProdcutFamilyCategoryInstallAtCountry) { 
obj = mapRAFProdcutFamilyCategoryInstallAtCountry[installAtCountryKey]; 
log = 'Chunk 2 Rule 1 Applied [ Install At Country = ' + quoteInstallAtCountry + ' Pricing Product Family = ' + line.record['Pricing_Product_Family__c'] +' Product Type = '+ line.record['Product_Type__c'] +' ]'; 
}else if (regionKey in mapRAFProdcutFamilyCategoryRegion) { 
obj = mapRAFProdcutFamilyCategoryRegion[regionKey]; 
log = 'Chunk 2 Rule 2 Applied [ Region = ' + quoteRegion + ' Pricing Product Family = ' + line.record['Pricing_Product_Family__c'] +' Product Type = '+ line.record['Product_Type__c'] +' ]'; 
} 
else if (geoKey in mapRAFProdcutFamilyCategoryGeo) { 
obj = mapRAFProdcutFamilyCategoryGeo[geoKey]; 
log = 'Chunk 2 Rule 3 Applied [ Geo = ' + quoteGeo + ' Pricing Product Family = ' + line.record['Pricing_Product_Family__c'] +' Product Type = '+ line.record['Product_Type__c'] +' ]'; 
} 

if (obj) { 
applyDiscountsOnLineItemRAF(line, obj, 'RAF Rule 2', log); 
} 
else { 
remainingLines.push(line); 
} 

}); 
console.log('Remaining Lines after RAF rule 2:' + remainingLines.length); 
var result = {"remainingLines":remainingLines,"conn":conn,"objQuote":objQuote}; 
return result; 


}).then(function (result){ 
//We will pass the remaining lines to the new set of rules 
if (result.remainingLines) { 
console.log('Inside remaining lines: RAF '); 
return initRAFDiscountRule3(result.remainingLines, result.conn, result.objQuote); 
}else{ 
	return Promise.resolve();
} 
}); 
} 


//RAF Discount Rule 1 
//Rule 1 :: Match product Family, Product Service Sub Type and installAtCountry 
//Rule 2 :: Match product Family, Product Service Sub Type and Region 
//Rule 3 :: Match product Family, Product Service Sub Type and Geo 

function initRAFDiscountRule3(lines,conn, objQuote){ 
var productFamilySet = []; 
var productServiceSubTypeSet = []; 
var quoteInstallAtCountry = objQuote.Install_At_Country__c; 
var quoteGeo = objQuote.Geo__c; 
var quoteRegion = objQuote.Region__c; 
var quoteDistrict = objQuote.District__c; 

lines.forEach(function(line) { 
var productFamily = line.record['Pricing_Product_Family__c']; 
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


if(andConditions){ 
andConditions+=' AND '; 
} 
andConditions += ' Service_Sub_Type__c!=null AND Product_Family__c!=null '; 

if(dateCondition){ 
if(andConditions){ 
andConditions+=' AND '; 
} 
andConditions += dateCondition; 
} 
if(andConditions) 
rafSelectQuery = rafSelectQuery + whereClause + andConditions; 

console.log('RAF discount rule 3:' + rafSelectQuery); 
var mapRAFProdcutFamilyServiceSubtypeInstallAtCountry = {}; 
var mapRAFProdcutFamilyServiceSubtypeRegion = {}; 
var mapRAFProdcutFamilyServiceSubtypeGeo = {}; 
rafSelectQuery = rafSelectQuery + ' LIMIT 50000';
return conn.query(rafSelectQuery) 
.then(function(results) {	
logResultSize(results,rafSelectQuery,'RAF discount rule 3'); 
if (results.totalSize) { 
results.records.forEach(function(record) { 
var objValue = createObjectValue(record); 
var installAtCountryKey = record.Install_At_Country__c + record.Product_Family__c + record.Service_Sub_Type__c; 
mapRAFProdcutFamilyServiceSubtypeInstallAtCountry[installAtCountryKey] = objValue; 

var regionKey = record.Region__c + record.Product_Family__c + record.Service_Sub_Type__c; 
mapRAFProdcutFamilyServiceSubtypeRegion[regionKey] = objValue; 

var geoKey = record.Geo__c +record.Product_Family__c + record.Service_Sub_Type__c; 
mapRAFProdcutFamilyServiceSubtypeGeo[geoKey] = objValue; 
}); 
} 
var remainingLines = []; 
lines.forEach(function(line) { 
var log = ''; 
var obj; 
var installAtCountryKey = quoteInstallAtCountry + line.record['Pricing_Product_Family__c'] + line.record['HDSServiceSubType__c']; 
var regionKey = quoteRegion + line.record['Pricing_Product_Family__c'] + line.record['HDSServiceSubType__c']; 
var geoKey = quoteGeo + line.record['Pricing_Product_Family__c'] + line.record['HDSServiceSubType__c']; 

if (installAtCountryKey in mapRAFProdcutFamilyServiceSubtypeInstallAtCountry) { 
obj = mapRAFProdcutFamilyServiceSubtypeInstallAtCountry[installAtCountryKey]; 
log = 'Chunk 3 Rule 1 Applied [ Install At Country = ' + quoteInstallAtCountry + ' Pricing Product Family = ' + line.record['Pricing_Product_Family__c'] +' Service SubType = '+ line.record['HDSServiceSubType__c'] +' ]'; 
}else if (regionKey in mapRAFProdcutFamilyServiceSubtypeRegion) { 
obj = mapRAFProdcutFamilyServiceSubtypeRegion[regionKey]; 
log = 'Chunk 3 Rule 2 Applied [ Region = ' + quoteRegion + ' Pricing Product Family = ' + line.record['Pricing_Product_Family__c'] +' Service SubType = '+ line.record['HDSServiceSubType__c'] +' ]'; 
} 
else if (geoKey in mapRAFProdcutFamilyServiceSubtypeGeo) { 
obj = mapRAFProdcutFamilyServiceSubtypeGeo[geoKey]; 
log = 'Chunk 3 Rule 3 Applied [ Geo = ' + quoteGeo + ' Pricing Product Family = ' + line.record['Pricing_Product_Family__c'] +' Service SubType = '+ line.record['HDSServiceSubType__c'] +' ]'; 
} 

if (obj) { 
applyDiscountsOnLineItemRAF(line, obj, 'RAF Rule 3',log); 
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

}); 
} 


//Customer Discount Rule 1 
//Rule 1 :: Match Service Sub Type, End User Category, and VSOE Discount Category 
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
orConditions = ' (VSOE_Discount_Category__c IN ' + vsoeDiscountList + ')'; 
} 
orConditions = ' (' + orConditions + ')'; 
} 
if(dateCondition){ 
if(orConditions){ 
orConditions+=' AND '; 
} 
orConditions += dateCondition; 
} 

if(orConditions){ 
orConditions+=' AND '; 
} 
orConditions += 'VSOE_Discount_Category__c != null AND Service_Sub_Type__c !=null AND End_User_Category__c !=null'; 

var query = customerSelectQuery; 
if (orConditions) { 
query = query + whereClause + orConditions; 
} 
query = query + ' LIMIT 50000'; 
console.log('Customer discount rule 1:' + query); 
var mapCustomerDiscount1VSOE = {}; 

//Iterating over all the results that was queried for CustomerDiscount lookup and creating map 
return conn.query(query) 
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
//Initialize Customer_Partner_Logs__c field on QLI with default String 
line.record['Customer_Partner_Logs__c'] = 'No Customer Discount Applied, No match found in Table'; 
line.record['Partner_Discount_Adjustment_Amount__c'] = null; 
line.record['Partner_Discount_Applied__c'] = false; 
line.record['Partner_Discount_Adjustment_Type__c'] = null; 

var obj; 
var log = ''; 
var customerVSOEKey = line.record['HDSServiceSubType__c'] + line.record['VSOE_Discount__c'] + objQuote.End_User_Category__c; 
if (customerVSOEKey in mapCustomerDiscount1VSOE) { 
obj = mapCustomerDiscount1VSOE[customerVSOEKey]; 
log = 'Customer Rules Chunk 1 Rule 1 Applied [ Service SubType = ' + line.record['HDSServiceSubType__c'] + ' VSOE Discount Category = ' + line.record['VSOE_Discount__c'] + ' End User Category = ' + objQuote.End_User_Category__c + ' ]'; 
} 

if (obj) { 
applyDiscountsOnLineItem(line, obj, 'Customer Rule 1',log); 
} 
else { 
remainingLines.push(line); 
} 

}); 
console.log('Remaining Lines after rule1:' + remainingLines.length); 
var result = {"remainingLines":remainingLines,"conn":conn,"objQuote":objQuote}; 
return result; 


}).then(function(result){ 
//We will pass the remaining lines to the new set of rules 
if (result.remainingLines.length) { 
console.log('Inside remaining lines:'); 
return initCustomerDiscountRule2(result.remainingLines, result.conn, result.objQuote); 
}else{
	return Promise.resolve();
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
conditions = " Bill_To_Account__c = '" + billToAccount + "'"; 
} 
if (billToSite) { 
if (conditions) { 
conditions += " AND Bill_To_Site__c ='" + billToSite + "'"; 
} 
else { 
conditions = " Bill_To_Site__c ='" + billToSite + "'"; 
} 

} 
if(dateCondition){ 
if(conditions){ 
conditions+=' AND '; 
} 
conditions += dateCondition; 
} 

if(conditions){ 
conditions+=' AND '; 
} 
conditions += 'Bill_To_Site__c != null AND Bill_To_Account__c !=null'; 


//Creating Query 
var query = customerSelectQuery; 
if (conditions) { 
query = query + whereClause + conditions; 
} 

query = query + ' LIMIT 50000'; 
console.log('Customer discount rule 2:' + query); 

var mapCustomerDiscount2ProductPCode = {}; 
var mapCustomerDiscount2ProductLineSubType = {}; 
var mapCustomerDiscount2ProductLinePricingCategory = {}; 
var mapCustomerDiscount2ProductFamilySubType = {}; 
var mapCustomerDiscount2ProductFamilyPricingCategory = {}; 
//Iterating over all the results that was queried for CustomerDiscount lookup and creating map 
return conn.query(query) 
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

var productCodeKey = line.record['Pricing_Product__c'] + billToAccount + billToSite; 
var productLineSubTypeKey = billToAccount + billToSite + line.record['Product_Line__c'] + line.record['HDSServiceSubType__c']; 
var productLinePricingCategoryKey = billToAccount + billToSite + line.record['Product_Line__c']; + line.record['Product_Type__c']; 
var productFamilySubTypeKey = billToAccount + billToSite + line.record['Pricing_Product_Family__c'] + line.record['HDSServiceSubType__c']; 
var productFamilyPricingCategoryKey = billToAccount + billToSite + line.record['Pricing_Product_Family__c']; + line.record['Product_Type__c']; 

var obj; 
var log = ''; 

if (productCodeKey in mapCustomerDiscount2ProductPCode) { 
obj = mapCustomerDiscount2ProductPCode[productCodeKey]; 
log = 'Customer Rules Chunk 2 Rule 1 Applied [ Pricing Product = ' + line.record['Pricing_Product__c'] + ' Bill To Account = ' + billToAccount + ' Bill To Site = ' + billToSite + ' ]'; 
} 
else if (productLineSubTypeKey in mapCustomerDiscount2ProductLineSubType) { 
obj = mapCustomerDiscount2ProductLineSubType[productLineSubTypeKey]; 
log = 'Customer Rules Chunk 2 Rule 2 Applied [ Bill To Account = ' + billToAccount + ' Bill To Site = ' + billToSite + ' Product Line = '+ line.record['Product_Line__c'] + ' Service Subtype = ' + line.record['HDSServiceSubType__c'] +' ]'; 
} 
else if (productLinePricingCategoryKey in mapCustomerDiscount2ProductLinePricingCategory) { 
obj = mapCustomerDiscount2ProductLinePricingCategory[productLinePricingCategoryKey]; 
log = 'Customer Rules Chunk 2 Rule 3 Applied [ Bill To Account = ' + billToAccount + ' Bill To Site = ' + billToSite + ' Product Line = '+ line.record['Product_Line__c'] + ' Product Type = ' + line.record['Product_Type__c'] +' ]'; 
} 
else if (productFamilySubTypeKey in mapCustomerDiscount2ProductFamilySubType) { 
obj = mapCustomerDiscount2ProductFamilySubType[productFamilySubTypeKey]; 
log = 'Customer Rules Chunk 2 Rule 4 Applied [ Bill To Account = ' + billToAccount + ' Bill To Site = ' + billToSite + ' Product Family = '+ line.record['Pricing_Product_Family__c'] + ' Service Subtype = ' + line.record['HDSServiceSubType__c'] +' ]'; 
} 
else if (productFamilyPricingCategoryKey in mapCustomerDiscount2ProductFamilyPricingCategory) { 
obj = mapCustomerDiscount2ProductFamilyPricingCategory[productFamilyPricingCategoryKey]; 
log = 'Customer Rules Chunk 2 Rule 5 Applied [ Bill To Account = ' + billToAccount + ' Bill To Site = ' + billToSite + ' Product Family = '+ line.record['Pricing_Product_Family__c'] + ' Product Type = ' + line.record['Product_Type__c'] +' ]'; 
} 

if (obj) { 
applyDiscountsOnLineItem(line, obj, 'Rule2',log); 
} 
else { 
remainingLines.push(line); 
} 


}); 

var result = {"remainingLines":remainingLines,"conn":conn,"objQuote":objQuote}; 
return result; 


}).then(function(result){ 
console.log('Remaining Lines after rule2:' + result.remainingLines.length); 
//We will pass the remaining lines to the new set of rules 
if (result.remainingLines.length) { 
initCustomerDiscountRule3(result.remainingLines, result.conn, result.objQuote); 
}else{
	return Promise.resolve();
}	
}); 

} 

// Customer Discount Rule 3 
//Makes rules 7-12 match based on Service Sub Type & End User Category 
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
orConditions = ' (Service_Sub_Type__c IN ' + subTypeList + ')'; 
} 
orConditions = ' (' + orConditions + ')'; 

} 
if(dateCondition){ 
if(orConditions){ 
orConditions+=' AND '; 
} 
orConditions += dateCondition; 
} 

if(orConditions){ 
orConditions+=' AND '; 
} 
orConditions += 'Service_Sub_Type__c != null AND Bill_To_Account__c !=null AND End_User_Category__c!=null'; 

//Creating Query 
var query = customerSelectQuery + whereClause + orConditions; 

if (endUserCategory) { 
if(orConditions){ 
query += " AND End_User_Category__c = '" + endUserCategory + "'"; 
}else{ 
query += " End_User_Category__c = '" + endUserCategory + "'"; 
} 
} 
/*if (installAtCountry) { 
if (endUserCategory || orConditions) { 
query += " AND Install_At_Country__c = '" + installAtCountry + "'"; 
}else{	
query += " Install_At_Country__c = '" + installAtCountry + "'"; 
} 
}*/ 
query = query + ' LIMIT 50000'; 
console.log('Customer discount rule 3:' + query); 

var mapCustomerDiscount3CountryProductLine = {}; 
var mapCustomerDiscount3RegionProductLine = {}; 
var mapCustomerDiscount3GeoProductLine = {}; 
var mapCustomerDiscount3CountryProductFamily = {}; 
var mapCustomerDiscount3RegionProductFamily = {}; 
var mapCustomerDiscount3GeoProductFamily = {}; 

//Iterating over all the results that was queried for CustomerDiscount lookup and creating map 
return conn.query(query) 
.then(function(results) { 
if (results.totalSize) { 

logResultSize(results,query,'Customer discount rule 3'); 
results.records.forEach(function(record) { 

var objValue = createObjectValue(record); 

var countryProductLineKey = ((record.Install_At_Country__c==null || record.Install_At_Country__c == '') ? record.Install_At_Country__c : record.Install_At_Country__c.toUpperCase()) + record.Product_Line__c + record.Service_Sub_Type__c + endUserCategory; 
mapCustomerDiscount3CountryProductLine[countryProductLineKey] = objValue; 

var regionProductLineKey = record.Region__c + record.Product_Line__c + record.Service_Sub_Type__c + endUserCategory; 
mapCustomerDiscount3RegionProductLine[regionProductLineKey] = objValue; 

var geoProductLineKey = record.Geo__c + record.Product_Line__c + record.Service_Sub_Type__c + endUserCategory; 
mapCustomerDiscount3GeoProductLine[geoProductLineKey] = objValue; 

var countryProductFamilyKey = ((record.Install_At_Country__c==null || record.Install_At_Country__c == '') ? record.Install_At_Country__c : record.Install_At_Country__c.toUpperCase()) + record.Product_Family__c + record.Service_Sub_Type__c + endUserCategory; 
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
var allCountryProductLineKey = WILDCARD_All + line.record['Product_Line__c'] + line.record['HDSServiceSubType__c'] + endUserCategory; 
var regionProductLineKey = quoteRegion+ line.record['Product_Line__c'] + line.record['HDSServiceSubType__c'] + endUserCategory; 
var geoProductLineKey = quoteGeo + line.record['Product_Line__c'] + line.record['HDSServiceSubType__c'] + endUserCategory; 
var countryProductFamilyKey = installAtCountry + line.record['Pricing_Product_Family__c'] + line.record['HDSServiceSubType__c'] + endUserCategory; 
var allCountryProductFamilyKey = WILDCARD_All + line.record['Pricing_Product_Family__c'] + line.record['HDSServiceSubType__c'] + endUserCategory; 
var regionProductFamilyKey = quoteRegion + line.record['Pricing_Product_Family__c'] + line.record['HDSServiceSubType__c'] + endUserCategory; 
var geoProductFamilyKey = quoteGeo + line.record['Pricing_Product_Family__c'] + line.record['HDSServiceSubType__c'] + endUserCategory; 

var obj; 
var log = ''; 

if (countryProductLineKey in mapCustomerDiscount3CountryProductLine) { 
obj = mapCustomerDiscount3CountryProductLine[countryProductLineKey]; 
log = 'Customer Rules Chunk 3 Rule 1 Applied [ Install At Country = ' + installAtCountry + ' Product Line = ' + line.record['Product_Line__c'] + ' Service Subtype = ' + line.record['HDSServiceSubType__c'] + ' End User Category = ' + endUserCategory+ ' ]'; 
} 
if (allCountryProductLineKey in mapCustomerDiscount3CountryProductLine) { 
obj = mapCustomerDiscount3CountryProductLine[allCountryProductLineKey]; 
log = 'Customer Rules Chunk 3 Rule 1 Applied [ Install At Country = ' + WILDCARD_All + ' Product Line = ' + line.record['Product_Line__c'] + ' Service Subtype = ' + line.record['HDSServiceSubType__c'] + ' End User Category = ' + endUserCategory+ ' ]'; 
} 
else if (regionProductLineKey in mapCustomerDiscount3RegionProductLine) { 
obj = mapCustomerDiscount3RegionProductLine[regionProductLineKey]; 
log = 'Customer Rules Chunk 3 Rule 2 Applied [ Region = ' + quoteRegion + ' Product Line = ' + line.record['Product_Line__c'] + ' Service Subtype = ' + line.record['HDSServiceSubType__c'] + ' End User Category = ' + endUserCategory+ ' ]'; 
} 
else if (geoProductLineKey in mapCustomerDiscount3GeoProductLine) { 
obj = mapCustomerDiscount3GeoProductLine[geoProductLineKey]; 
log = 'Customer Rules Chunk 3 Rule 3 Applied [ Geo = ' + quoteGeo + ' Product Line = ' + line.record['Product_Line__c'] + ' Service Subtype = ' + line.record['HDSServiceSubType__c'] + ' End User Category = ' + endUserCategory+ ' ]'; 
} 
else if (countryProductFamilyKey in mapCustomerDiscount3CountryProductFamily) { 
obj = mapCustomerDiscount3CountryProductFamily[countryProductFamilyKey]; 
log = 'Customer Rules Chunk 3 Rule 4 Applied [ Install At Country = ' + installAtCountry + ' Product Family = ' + line.record['Pricing_Product_Family__c'] + ' Service Subtype = ' + line.record['HDSServiceSubType__c'] + ' End User Category = ' + endUserCategory+ ' ]'; 
} 
else if (allCountryProductFamilyKey in mapCustomerDiscount3CountryProductFamily) { 
obj = mapCustomerDiscount3CountryProductFamily[allCountryProductFamilyKey]; 
log = 'Customer Rules Chunk 3 Rule 4 Applied [ Install At Country = ' + WILDCARD_All + ' Product Family = ' + line.record['Pricing_Product_Family__c'] + ' Service Subtype = ' + line.record['HDSServiceSubType__c'] + ' End User Category = ' + endUserCategory+ ' ]'; 
} 
else if (regionProductFamilyKey in mapCustomerDiscount3RegionProductFamily) { 
obj = mapCustomerDiscount3RegionProductFamily[regionProductFamilyKey]; 
log = 'Customer Rules Chunk 3 Rule 5 Applied [ Region = ' + quoteRegion + ' Product Family = ' + line.record['Pricing_Product_Family__c'] + ' Service Subtype = ' + line.record['HDSServiceSubType__c'] + ' End User Category = ' + endUserCategory+ ' ]'; 
} 
else if (geoProductFamilyKey in mapCustomerDiscount3GeoProductFamily) { 
obj = mapCustomerDiscount3GeoProductFamily[geoProductFamilyKey]; 
log = 'Customer Rules Chunk 3 Rule 6 Applied [ Geo = ' + quoteGeo + ' Product Family = ' + line.record['Pricing_Product_Family__c'] + ' Service Subtype = ' + line.record['HDSServiceSubType__c'] + ' End User Category = ' + endUserCategory+ ' ]'; 
} 

if (obj) { 
applyDiscountsOnLineItem(line, obj, 'Custome Rule 3', log); 
} 
else { 
remainingLines.push(line); 
} 
}); 
var result = {"remainingLines":remainingLines,"conn":conn,"objQuote":objQuote}; 
return result; 

}).then(function(result){ 
console.log('Remaining Lines after rule3:' + result.remainingLines.length); 
//We will pass the remaining lines to the new set of rules 
if (result.remainingLines.length) { 
initCustomerDiscountRule4(result.remainingLines, result.conn, result.objQuote); 
}else{
	return Promise.resolve();
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
var productFamily = line.record['Pricing_Product_Family__c']; 
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
orConditions = ' (Product_Family__c IN ' + productFamilyList + ')'; 
} 
orConditions = ' (' + orConditions + ')'; 
} 
if (pricingCategories.length) { 
var pricingCategoryList = "('" + pricingCategories.join("', '") + "')"; 
if (orConditions) { 
orConditions = orConditions + ' OR ' + ' (Pricing_Category__c IN ' + pricingCategoryList + ')'; 
} 
else { 
orConditions = ' (Pricing_Category__c IN ' + pricingCategoryList + ')'; 
} 
orConditions = ' (' + orConditions + ')'; 
} 
if(dateCondition){ 
if(orConditions){ 
orConditions+=' AND '; 
} 
orConditions += dateCondition; 
} 

if(orConditions){ 
orConditions+=' AND '; 
} 
orConditions += 'Pricing_Category__c!=null AND Product_Family__c!=null AND End_User_Category__c!=null'; 

var query = customerSelectQuery + whereClause + orConditions; 
var mapCustomerDiscount4Geo = {}; 
var mapCustomerDiscount4Country = {}; 
var mapCustomerDiscount4Region = {}; 

console.log('Customer discount rule 4:' + query); 
query = query + ' LIMIT 50000';
//Iterating over all the results that was queried for CustomerDiscount lookup and creating map 
return conn.query(query) 
.then(function(results) { 
logResultSize(results,query,'Customer discount rule 4'); 
if (results.totalSize) { 
results.records.forEach(function(record) { 

var objValue = createObjectValue(record); 

var geoKey = record.Geo__c + record.Product_Family__c + record.End_User_Category__c + record.Pricing_Category__c; 
mapCustomerDiscount4Geo[geoKey] = objValue; 

var countryKey = ((record.Install_At_Country__c==null || record.Install_At_Country__c == '') ? record.Install_At_Country__c : record.Install_At_Country__c.toUpperCase()) + record.Product_Family__c + record.End_User_Category__c + record.Pricing_Category__c;; 
mapCustomerDiscount4Country[countryKey] = objValue; 

var regionKey = record.Region__c + record.Product_Family__c + record.End_User_Category__c + record.Pricing_Category__c ; 
mapCustomerDiscount4Region[regionKey] = objValue; 
}); 

} 
var remainingLines = []; 
lines.forEach(function(line) { 

var countryKey = installAtCountry + line.record['Pricing_Product_Family__c'] + endUserCategory + line.record['Product_Type__c']; 
var allCountryKey = WILDCARD_All + line.record['Pricing_Product_Family__c'] + endUserCategory + line.record['Product_Type__c']; 
var regionKey = quoteRegion + line.record['Pricing_Product_Family__c'] + endUserCategory + line.record['Product_Type__c']; 
var geoKey = quoteGeo + line.record['Pricing_Product_Family__c'] + endUserCategory + line.record['Product_Type__c'] ; 

var obj; 
var log = ''; 

if (countryKey in mapCustomerDiscount4Country) { 
obj = mapCustomerDiscount4Country[countryKey]; 
log = 'Customer Rules Chunk 4 Rule 1 Applied [ Install At Country = ' + installAtCountry + ' Product Family = ' + line.record['Pricing_Product_Family__c'] + ' Product Type = ' + line.record['Product_Type__c'] + ' End User Category = ' + endUserCategory+ ' ]'; 
}else if (allCountryKey in mapCustomerDiscount4Country) { 
obj = mapCustomerDiscount4Country[allCountryKey]; 
log = 'Customer Rules Chunk 4 Rule 1 Applied [ Install At Country = ' + WILDCARD_All + ' Product Family = ' + line.record['Pricing_Product_Family__c'] + ' Product Type = ' + line.record['Product_Type__c'] + ' End User Category = ' + endUserCategory+ ' ]'; 
} 
else if (regionKey in mapCustomerDiscount4Region) { 
obj = mapCustomerDiscount4Region[regionKey]; 
log = 'Customer Rules Chunk 4 Rule 2 Applied [ Region = ' + quoteRegion + ' Product Family = ' + line.record['Pricing_Product_Family__c'] + ' Product Type = ' + line.record['Product_Type__c'] + ' End User Category = ' + endUserCategory+ ' ]'; 
} 
else if (geoKey in mapCustomerDiscount4Geo) { 
obj = mapCustomerDiscount4Geo[geoKey]; 
log = 'Customer Rules Chunk 4 Rule 3 Applied [ Geo = ' + quoteGeo + ' Product Family = ' + line.record['Pricing_Product_Family__c'] + ' Product Type = ' + line.record['Product_Type__c'] + ' End User Category = ' + endUserCategory+ ' ]'; 
} 

if (obj) { 
applyDiscountsOnLineItem(line, obj, 'Customer Rule 4',log); 
} 
else { 
remainingLines.push(line); 
} 
}); 
console.log('We still have Remaining Lines after rule4:' + remainingLines.length); 

//AlL Customer Rules Applied 

}); 
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
"type": record.Adjustment_Type__c, 
"ID": record.Id, 
}; 
return objValue; 
} 

//Apply DiscountOn QuoteLineItem 
//Parameters : Quoteline, CustomArrayObject, RuleNumber 
//CustomArrayObject Sturcture :: Array 
//discount : discount to be applied 
//type : type of discount applied 
function applyDiscountsOnLineItem(line, obj, ruleNumber,log) { 
//Logging Applied rule on QLI record 
var updatedLog = log + ' RuleID = ' + obj['ID'] + ' [ Adj. Type = '+ obj['type'] + ' Adj. Amt = ' + obj['discount']+' ]'; 
console.log('Log generated for Partner/Customer Rule == ' + updatedLog); 
line.record['Customer_Partner_Logs__c'] = updatedLog; 

line.record['Partner_Discount_Adjustment_Amount__c'] = obj['discount'] || 0; 
line.record['Partner_Discount_Applied__c'] = true; 
line.record['Partner_Discount_Adjustment_Type__c'] = obj['type']; 
} 

//Apply DiscountOn QuoteLineItem for RAF 
//Parameters : Quoteline, CustomArrayObject, RuleNumber 
//CustomArrayObject Sturcture :: Array 
//discount : discount to be applied 
//type : type of discount applied 
function applyDiscountsOnLineItemRAF(line, obj, ruleNumber,log) { 
//Logging Applied rule on QLI record 
var updatedLog = log + ' RuleID = ' + obj['ID'] + ' [ Adj. Type = '+ obj['type'] + ' Adj. Amt = ' + obj['discount']+' ]'; 
console.log('Log generated for RAF == ' + updatedLog); 
line.record['RAF_Logs__c'] = updatedLog; 

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
orConditions = ' (VSOE_Discount_Category__c IN ' + vsoeDiscountList + ')'; 
} 
orConditions = ' (' + orConditions + ')'; 
} 
if (serviceSubtypes.length) { 

var vserviceSubtypesList = "('" + serviceSubtypes.join("', '") + "')"; 
if (orConditions) { 
orConditions = orConditions + ' AND ' + ' (Service_Sub_Type__c IN ' + vserviceSubtypesList + ')'; 
} 
else { 
orConditions = ' (Service_Sub_Type__c IN ' + vserviceSubtypesList + ')'; 
} 
orConditions = ' (' + orConditions + ')'; 
} 
if(dateCondition){ 
if(orConditions){ 
orConditions+=' AND '; 
} 
orConditions += dateCondition; 
} 

if(orConditions){ 
orConditions+=' AND '; 
} 
orConditions += ' End_User_Category__c !=null AND Service_Sub_Type__c!=null AND VSOE_Discount_Category__c!=null '; 

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
query = query + ' LIMIT 50000'; 
console.log('Partner Discount rule 1 Query : ' + query); 
var mapCustomerDiscount1VSOE = {}; 

//Iterating over all the results that was queried for PartnerDiscount lookup and creating map 
return conn.query(query) 
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
//Initialize Customer_Partner_Logs__c field on QLI with default String 
line.record['Customer_Partner_Logs__c'] = 'No Partner Discount Applied, No match found in Table'; 
line.record['Partner_Discount_Adjustment_Amount__c'] = null; 
line.record['Partner_Discount_Applied__c'] = false; 
line.record['Partner_Discount_Adjustment_Type__c'] = null; 
var obj; 
var log = ''; 
var customerVSOEKey = line.record['HDSServiceSubType__c'] + line.record['VSOE_Discount__c'] + objQuote.End_User_Category__c; 
if (customerVSOEKey in mapCustomerDiscount1VSOE) { 
log = 'Partner Rules Chunk 1 Rule 1 Applied [ Service SubType = ' + line.record['HDSServiceSubType__c'] + ' VSOE Category = ' + line.record['VSOE_Discount__c'] + ' End User Category = ' + objQuote.endUserCategory+ ' ]'; 
obj = mapCustomerDiscount1VSOE[customerVSOEKey]; 
} 

if (obj) { 
applyDiscountsOnLineItem(line, obj, 'Partner Rule 1' ,log); 
} 
else { 
remainingLines.push(line); 
} 

}); 
console.log('Remaining Lines after rule 1: ' + remainingLines.length); 
var result = {"remainingLines":remainingLines,"conn":conn,"objQuote":objQuote}; 
return result; 


}).then(function(result){ 
//We will pass the remaining lines to the new set of rules 
if (result.remainingLines.length) { 
console.log('PD Inside remaining lines: '); 
initPartnerDiscountRule2(result.remainingLines, result.conn, result.objQuote); 
}else{
	return Promise.resolve();
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
conditions = " Bill_To_Account__c = '" + billToAccount + "'"; 
} 
if (billToSite) { 
if (conditions) { 
conditions += " AND Bill_To_Site__c ='" + billToSite + "'"; 
} 
else { 
conditions = " Bill_To_Site__c ='" + billToSite + "'"; 
} 

} 

if(conditions){ 
conditions+=' AND '; 
} 
conditions += ' Bill_To_Site__c !=null AND Bill_To_Account__c!=null '; 

//Creating Query 
var query = customerSelectQuery; 
if (conditions) { 
query = query + whereClause + conditions; 
} 
query = query + ' LIMIT 50000'; 
console.log('Partner Discount rule 2: Query' + query); 

var mapCustomerDiscount2ProductPCode = {}; 
var mapCustomerDiscount2ProductLinePricingCategory = {}; 
var mapCustomerDiscount2ProductFamilySubType = {}; 
var mapCustomerDiscount2ProductFamilyPricingCategory = {}; 

//Iterating over all the results that was queried for PartnerDiscount lookup and creating map 
return conn.query(query) 
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

var productCodeKey = line.record['Pricing_Product__c'] + billToAccount + billToSite; 
var productLinePricingCategoryKey = billToAccount + billToSite + line.record['Product_Line__c'] + line.record['Product_Type__c']; 
var productFamilySubTypeKey = billToAccount + billToSite + line.record['Pricing_Product_Family__c'] + line.record['HDSServiceSubType__c']; 
var productFamilyPricingCategoryKey = billToAccount + billToSite + line.record['Pricing_Product_Family__c'] + line.record['Product_Type__c']; 

var obj; 
var log = ''; 

if (productCodeKey in mapCustomerDiscount2ProductPCode) { 
obj = mapCustomerDiscount2ProductPCode[productCodeKey]; 
log = 'Partner Rules Chunk 2 Rule 1 Applied [ Product P Code = ' + line.record['Pricing_Product__c'] + ' Bill To Account = ' + billToAccount + ' Bill To Site = ' + billToSite+ ' ]'; 
} 
else if (productLinePricingCategoryKey in mapCustomerDiscount2ProductLinePricingCategory) { 
obj = mapCustomerDiscount2ProductLinePricingCategory[productLinePricingCategoryKey]; 
log = 'Partner Rules Chunk 2 Rule 2 Applied [ Bill To Account = ' + billToAccount + ' Bill To Site = ' + billToSite+ ' Product Line = '+line.record['Product_Line__c']+ ' Product Type = '+ line.record['Product_Type__c'] +' ]'; 
} 
else if (productFamilySubTypeKey in mapCustomerDiscount2ProductFamilySubType) { 
obj = mapCustomerDiscount2ProductFamilySubType[productFamilySubTypeKey]; 
log = 'Partner Rules Chunk 2 Rule 3 Applied [ Bill To Account = ' + billToAccount + ' Bill To Site = ' + billToSite+ ' Product Family = '+line.record['Pricing_Product_Family__c']+ ' Service SubType = '+ line.record['HDSServiceSubType__c'] +' ]'; 
} 
else if (productFamilyPricingCategoryKey in mapCustomerDiscount2ProductFamilyPricingCategory) { 
obj = mapCustomerDiscount2ProductFamilyPricingCategory[productFamilyPricingCategoryKey]; 
log = 'Partner Rules Chunk 2 Rule 4 Applied [ Bill To Account = ' + billToAccount + ' Bill To Site = ' + billToSite+ ' Product Family = '+line.record['Pricing_Product_Family__c']+ ' Product Type = '+ line.record['Product_Type__c'] +' ]'; 
} 

if (obj) { 
applyDiscountsOnLineItem(line, obj, 'Partner Rule 2', log); 
} 
else { 
remainingLines.push(line); 
} 
}); 

console.log('Remaining Lines after rule2:' + remainingLines.length); 
var result = {"remainingLines":remainingLines,"conn":conn,"objQuote":objQuote}; 
return result; 

}).then(function(result){ 
//We will pass the remaining lines to the new set of rules 
if (result.remainingLines.length) { 
console.log('Calling rule 3 :: with ' + result.remainingLines.length); 

initPartnerDiscountRule3(result.remainingLines, result.conn, result.objQuote); 
}else{
	return Promise.resolve();
}	
}); 

} 

//Partner Discount Rule 3 
//Match based on Product Family, Service Sub Type, and Partner Level 
//Rule 6 Match Install At Country, Product Family, Service Sub Type, and Partner Level 
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
var productF = line.record['Pricing_Product_Family__c']; 
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
orConditions = ' (Service_Sub_Type__c IN ' + subTypeList + ')'; 
} 
orConditions = ' (' + orConditions + ')'; 

} 

if (productFamily.length) { 

var productFamilyList = "('" + productFamily.join("', '") + "')"; 
if (orConditions) { 
orConditions = orConditions + ' AND ' + ' (Product_Family__c IN ' + productFamilyList + ')'; 
} 
else { 
orConditions = ' (Product_Family__c IN ' + productFamilyList + ')'; 
} 
orConditions = ' (' + orConditions + ')'; 

} 
if(dateCondition){ 
if(orConditions){ 
orConditions+=' AND '; 
} 
orConditions += dateCondition; 
} 

if(orConditions){ 
orConditions+=' AND '; 
} 
orConditions += ' Service_Sub_Type__c !=null AND Product_Family__c!=null AND Program_Level__c!=null '; 


var query = customerSelectQuery + whereClause + orConditions; 
if (partnerLevel) { 
query += " AND Program_Level__c = '" + partnerLevel + "'"; 
} 
//console.log('Partner discount rule 3: Query' + query); 

var mapCustomerDiscount3Country = {}; 
var mapCustomerDiscount3Distict = {}; 
var mapCustomerDiscount3Region = {}; 
var mapCustomerDiscount3Geo= {}; 
query = query + ' LIMIT 50000';
//Iterating over all the results that was queried for PartnerDiscount lookup and creating map 
return conn.query(query) 
.then(function(results) { 
logResultSize(results,query,'Partner Discount rule 3'); 
if (results.totalSize) { 
results.records.forEach(function(record) { 

var objValue = createObjectValue(record); 

var countryKey = ((record.Install_At_Country__c==null || record.Install_At_Country__c == '') ? record.Install_At_Country__c : record.Install_At_Country__c.toUpperCase()) + record.Product_Family__c + record.Service_Sub_Type__c + record.Program_Level__c; 
mapCustomerDiscount3Country[countryKey] = objValue; 

//var districtKey = record.District__c + record.Product_Family__c + record.Service_Sub_Type__c + record.Program_Level__c; 
//mapCustomerDiscount3Distict[districtKey] = objValue; 

var regionKey = record.Region__c + record.Product_Family__c + record.Service_Sub_Type__c + record.Program_Level__c; 
mapCustomerDiscount3Region[regionKey] = objValue; 

var geoKey = record.Geo__c + record.Product_Family__c + record.Service_Sub_Type__c + record.Program_Level__c; 
mapCustomerDiscount3Geo[geoKey] = objValue; 

}); 

} 
var remainingLines = []; 
lines.forEach(function(line) { 
var countryKey = installAtCountry + line.record['Pricing_Product_Family__c'] + line.record['HDSServiceSubType__c'] + partnerLevel; 
var allCountryKey = WILDCARD_All + line.record['Pricing_Product_Family__c'] + line.record['HDSServiceSubType__c'] + partnerLevel; 
var regionKey = quoteRegion + line.record['Pricing_Product_Family__c'] + line.record['HDSServiceSubType__c'] + partnerLevel; 
var districtKey = quoteDistrict + line.record['Pricing_Product_Family__c'] + line.record['HDSServiceSubType__c'] + partnerLevel; 
var geoKey = quoteGeo + line.record['Pricing_Product_Family__c'] + line.record['HDSServiceSubType__c'] + partnerLevel; 

var obj; 
var log = ''; 

if (countryKey in mapCustomerDiscount3Country) { 
obj = mapCustomerDiscount3Country[countryKey]; 
log = 'Partner Rules Chunk 3 Rule 1 Applied [ Install At Country = ' + installAtCountry + ' Product Family = '+line.record['Pricing_Product_Family__c']+ ' Service SubType = '+ line.record['HDSServiceSubType__c'] + ' Partner Level = ' +partnerLevel+' ]'; 
} 
else if (allCountryKey in mapCustomerDiscount3Country) { 
obj = mapCustomerDiscount3Country[allCountryKey]; 
log = 'Partner Rules Chunk 3 Rule 1 Applied [ Install At Country = ' + WILDCARD_All + ' Product Family = '+line.record['Pricing_Product_Family__c']+ ' Service SubType = '+ line.record['HDSServiceSubType__c'] + ' Partner Level = ' +partnerLevel+' ]'; 
} 
else if (regionKey in mapCustomerDiscount3Region) { 
obj = mapCustomerDiscount3Region[regionKey]; 
log = 'Partner Rules Chunk 3 Rule 2 Applied [ Region = ' + quoteRegion + ' Product Family = '+line.record['Pricing_Product_Family__c']+ ' Service SubType = '+ line.record['HDSServiceSubType__c'] + ' Partner Level = ' +partnerLevel+' ]';} 
else if (geoKey in mapCustomerDiscount3Geo) { 
obj = mapCustomerDiscount3Geo[geoKey]; 
log = 'Partner Rules Chunk 3 Rule 3 Applied [ District = ' + quoteDistrict + ' Product Family = '+line.record['Pricing_Product_Family__c']+ ' Service SubType = '+ line.record['HDSServiceSubType__c'] + ' Partner Level = ' +partnerLevel+' ]'; 
} 
//else if (districtKey in mapCustomerDiscount3Distict) { 
// obj = mapCustomerDiscount3Distict[districtKey]; 
// log = 'Partner Rules Chunk 3 Rule 4 Applied [ Geo = ' + quoteGeo + ' Product Family = '+line.record['Pricing_Product_Family__c']+ ' Service SubType = '+ line.record['HDSServiceSubType__c'] + ' Partner Level = ' +partnerLevel+' ]'; 
//} 

if (obj) { 
applyDiscountsOnLineItem(line, obj, 'Partner Rule 3',log); 
} 
else { 
remainingLines.push(line); 
} 
}); 
console.log('Remaining Lines after rule 3 :: ' + remainingLines.length); 
var result = {"remainingLines":remainingLines,"conn":conn,"objQuote":objQuote}; 
return result; 

}).then(function(result){ 
//We will pass the remaining lines to the new set of rules 
if (result.remainingLines.length) { 
console.log('Calling rule 4 :: with ' + result.remainingLines.length); 
initPartnerDiscountRule4(result.remainingLines, result.conn, result.objQuote); 
}else{
	return Promise.resolve();
}	
}); 
} 

//Partner Discount Rule 4 
//Match based on Product Family, Pricing Category, and Partner Level 
//Rule 10 Match Install At Country , Product Family, Pricing Category, and Partner Level 
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
var productF = line.record['Pricing_Product_Family__c']; 
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
orConditions = ' (Pricing_Category__c IN ' + pricingCategoryList + ')'; 
} 
orConditions = ' (' + orConditions + ')'; 

} 

if (productFamily.length) { 

var productFamilyList = "('" + productFamily.join("', '") + "')"; 
if (orConditions) { 
orConditions = orConditions + ' AND ' + ' (Product_Family__c IN ' + productFamilyList + ')'; 
} 
else { 
orConditions = ' (Product_Family__c IN ' + productFamilyList + ')'; 
} 
orConditions = ' (' + orConditions + ')'; 

} 
if(dateCondition){ 
if(orConditions){ 
orConditions+=' AND '; 
} 
orConditions += dateCondition; 
} 

if(orConditions){ 
orConditions+=' AND '; 
} 
orConditions += ' Pricing_Category__c !=null AND Product_Family__c!=null AND Program_Level__c!=null '; 

//Creating Query 
var query = customerSelectQuery + whereClause + orConditions; 
if (partnerLevel) { 
query += " AND Program_Level__c = '" + partnerLevel + "'"; 
} 
console.log('Partner discount rule 4: Query' + query); 

var mapCustomerDiscount3InstalllAtCountry = {}; 
var mapCustomerDiscount3Region = {}; 
var mapCustomerDiscount3Geo= {}; 
query = query + ' LIMIT 50000';
//Iterating over all the results that was queried for PartnerDiscount lookup and creating map 
return conn.query(query) 
.then(function(results) { 
logResultSize(results,query,'Partner Discount rule 4'); 
if (results.totalSize) { 
results.records.forEach(function(record) { 

var objValue = createObjectValue(record); 


var installAtCountryKey = ((record.Install_At_Country__c==null || record.Install_At_Country__c == '') ? record.Install_At_Country__c : record.Install_At_Country__c.toUpperCase()) + record.Product_Family__c + record.Pricing_Category__c + record.Program_Level__c; 
mapCustomerDiscount3InstalllAtCountry[installAtCountryKey] = objValue;	

//var districtKey = record.District__c + record.Product_Family__c + record.Pricing_Category__c + record.Program_Level__c; 
//mapCustomerDiscount3Distict[districtKey] = objValue; 

var regionKey = record.Region__c + record.Product_Family__c + record.Pricing_Category__c + record.Program_Level__c; 
mapCustomerDiscount3Region[regionKey] = objValue; 

var geoKey = record.Geo__c + record.Product_Family__c + record.Pricing_Category__c + record.Program_Level__c; 
mapCustomerDiscount3Geo[geoKey] = objValue; 

}); 

} 

var remainingLines = []; 
lines.forEach(function(line) { 

var installAtCountryKey = installAtCountry + line.record['Pricing_Product_Family__c'] + line.record['Product_Type__c'] + partnerLevel; 
var allInstallAtCountryKey = WILDCARD_All + line.record['Pricing_Product_Family__c'] + line.record['Product_Type__c'] + partnerLevel; 
var regionKey = quoteRegion + line.record['Pricing_Product_Family__c'] + line.record['Product_Type__c'] + partnerLevel; 
//var districtKey = quoteDistrict + line.record['Pricing_Product_Family__c'] + line.record['Product_Type__c'] + partnerLevel; 
var geoKey = quoteGeo + line.record['Pricing_Product_Family__c'] + line.record['Product_Type__c'] + partnerLevel; 

var obj; 
var log = ''; 

if (installAtCountryKey in mapCustomerDiscount3InstalllAtCountry) { 
obj = mapCustomerDiscount3InstalllAtCountry[installAtCountryKey]; 
log = 'Partner Rules Chunk 4 Rule 1 Applied [ Install_At_Country__c = ' + installAtCountry + ' Product Family = '+line.record['Pricing_Product_Family__c']+ ' Product Type = '+ line.record['Product_Type__c'] + ' Partner Level = ' +partnerLevel+' ]'; 
}else if (allInstallAtCountryKey in mapCustomerDiscount3InstalllAtCountry) { 
obj = mapCustomerDiscount3InstalllAtCountry[allInstallAtCountryKey]; 
log = 'Partner Rules Chunk 4 Rule 1 Applied [ Install_At_Country__c = ' + WILDCARD_All + ' Product Family = '+line.record['Pricing_Product_Family__c']+ ' Product Type = '+ line.record['Product_Type__c'] + ' Partner Level = ' +partnerLevel+' ]'; 
}else if (regionKey in mapCustomerDiscount3Region) { 
obj = mapCustomerDiscount3Region[regionKey]; 
log = 'Partner Rules Chunk 4 Rule 2 Applied [ Region = ' + quoteRegion + ' Product Family = '+line.record['Pricing_Product_Family__c']+ ' Product Type = '+ line.record['Product_Type__c'] + ' Partner Level = ' +partnerLevel+' ]'; 
} 
else if (geoKey in mapCustomerDiscount3Geo) { 
obj = mapCustomerDiscount3Geo[geoKey]; 
log = 'Partner Rules Chunk 4 Rule 3 Applied [ Geo = ' + quoteDistrict + ' Product Family = '+line.record['Pricing_Product_Family__c']+ ' Product Type = '+ line.record['Product_Type__c'] + ' Partner Level = ' +partnerLevel+' ]'; 
} 
//else if (districtKey in mapCustomerDiscount3Distict) { 
// obj = mapCustomerDiscount3Distict[districtKey]; 
// log = 'Partner Rules Chunk 4 Rule 1 Applied [ Geo = ' + quoteGeo + ' Product Family = '+line.record['Pricing_Product_Family__c']+ ' Product Type = '+ line.record['Product_Type__c'] + ' Partner Level = ' +partnerLevel+' ]'; 
//} 

if (obj) { 
applyDiscountsOnLineItem(line, obj, 'Partner Rule 4',log); 
} 
else { 
remainingLines.push(line); 
} 
}); 
console.log('Remaining Lines after rule 4:' + remainingLines.length); 
var result = {"remainingLines":remainingLines,"conn":conn,"objQuote":objQuote}; 
return result; 

}).then(function(result){ 
//We will pass the remaining lines to the new set of rules 
if (result.remainingLines.length) { 
console.log('Calling rule 5 :: with ' + result.remainingLines.length); 

initPartnerDiscountRule5(result.remainingLines, result.conn, result.objQuote); 

}else{
	return Promise.resolve();
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
var productF = line.record['Pricing_Product_Family__c']; 
if (subType && subTypes.indexOf(subType) < 0) { 
subTypes.push(subType); 
} 
if (productF && productFamily.indexOf(productF) < 0) { 
productFamily.push(productF); 
} 
}); 

var customerSelectQuery = 'SELECT Id,Program_Level__c,Adjustment_Amount__c,Adjustment_Type__c,Service_Sub_Type__c,End_User_Category__c,Install_At_Country__c,Region__c,Geo__c,District__c,Product_Family__c,Product_Line__c,Partner_Service_Capability__c FROM Lookup_Partner_Discount__c '; 
var whereClause = " WHERE "; 

var orConditions = ''; 
if (subTypes.length) { 

var subTypeList = "('" + subTypes.join("', '") + "')"; 
if (orConditions) { 
orConditions = orConditions + ' AND ' + ' (Service_Sub_Type__c IN ' + subTypeList + ')'; 
} 
else { 
orConditions = ' (Service_Sub_Type__c IN ' + subTypeList + ')'; 
} 
orConditions = ' (' + orConditions + ')'; 

} 

if (productFamily.length) { 

var productFamilyList = "('" + productFamily.join("', '") + "')"; 
if (orConditions) { 
orConditions = orConditions + ' AND ' + ' (Product_Family__c IN ' + productFamilyList + ')'; 
} 
else { 
orConditions = ' (Product_Family__c IN ' + productFamilyList + ')'; 
} 
orConditions = ' (' + orConditions + ')'; 

} 
if(dateCondition){ 
if(orConditions){ 
orConditions+=' AND '; 
} 
orConditions += dateCondition; 
} 

if(orConditions){ 
orConditions+=' AND '; 
} 
orConditions += ' Service_Sub_Type__c !=null AND Product_Family__c!=null AND Partner_Service_Capability__c!=null '; 


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
query = query + ' LIMIT 50000';
//Iterating over all the results that was queried for PartnerDiscount lookup and creating map 
return conn.query(query) 
.then(function(results) { 
logResultSize(results,query,'Partner Discount rule 5'); 
if (results.totalSize) { 
results.records.forEach(function(record) { 

var objValue = createObjectValue(record); 
var countryKey = ((record.Install_At_Country__c==null || record.Install_At_Country__c == '') ? record.Install_At_Country__c : record.Install_At_Country__c.toUpperCase()) + record.Product_Family__c + record.Service_Sub_Type__c + record.Partner_Service_Capability__c; 
mapCustomerDiscount5Country[countryKey] = objValue; 

//var districtKey = record.District__c + record.Product_Family__c + record.Service_Sub_Type__c + record.Partner_Service_Capability__c; 
//mapCustomerDiscount5Distict[districtKey] = objValue; 

var regionKey = record.Region__c + record.Product_Family__c + record.Service_Sub_Type__c + record.Partner_Service_Capability__c; 
mapCustomerDiscount5Region[regionKey] = objValue; 

var geoKey = record.Geo__c + record.Product_Family__c + record.Service_Sub_Type__c + record.Partner_Service_Capability__c; 
mapCustomerDiscount5Geo[geoKey] = objValue; 

}); 

} 
var remainingLines = []; 
lines.forEach(function(line) { 


var countryKey = installAtCountry + line.record['Pricing_Product_Family__c'] + line.record['HDSServiceSubType__c'] + partnerServiceCapablity; 
var allCountryKey = WILDCARD_All + line.record['Pricing_Product_Family__c'] + line.record['HDSServiceSubType__c'] + partnerServiceCapablity; 
var regionKey = quoteRegion + line.record['Pricing_Product_Family__c'] + line.record['HDSServiceSubType__c'] + partnerServiceCapablity; 
var districtKey = quoteDistrict + line.record['Pricing_Product_Family__c'] + line.record['HDSServiceSubType__c'] + partnerServiceCapablity; 
var geoKey = quoteGeo + line.record['Pricing_Product_Family__c'] + line.record['HDSServiceSubType__c'] + partnerServiceCapablity; 

var obj; 
var log = ''; 

if (countryKey in mapCustomerDiscount5Country) { 
obj = mapCustomerDiscount5Country[countryKey]; 
log = 'Partner Rules Chunk 5 Rule 1 Applied [ Install At Country = ' + installAtCountry + ' Product Family = '+line.record['Pricing_Product_Family__c']+ ' Service SubType = '+ line.record['HDSServiceSubType__c'] + ' Partner Service Capablity = ' +partnerServiceCapablity+' ]'; 
} 
else if (allCountryKey in mapCustomerDiscount5Country) { 
obj = mapCustomerDiscount5Country[allCountryKey]; 
log = 'Partner Rules Chunk 5 Rule 1 Applied [ Install At Country = ' + WILDCARD_All + ' Product Family = '+line.record['Pricing_Product_Family__c']+ ' Service SubType = '+ line.record['HDSServiceSubType__c'] + ' Partner Service Capablity = ' +partnerServiceCapablity+' ]'; 
} 
else if (regionKey in mapCustomerDiscount5Region) { 
obj = mapCustomerDiscount5Region[regionKey]; 
log = 'Partner Rules Chunk 5 Rule 2 Applied [ Region = ' + quoteRegion + ' Product Family = '+line.record['Pricing_Product_Family__c']+ ' Service SubType = '+ line.record['HDSServiceSubType__c'] + ' Partner Service Capablity = ' +partnerServiceCapablity+' ]'; 
} 
else if (geoKey in mapCustomerDiscount5Geo) { 
obj = mapCustomerDiscount5Geo[geoKey]; 
log = 'Partner Rules Chunk 5 Rule 3 Applied [ District = ' + quoteDistrict + ' Product Family = '+line.record['Pricing_Product_Family__c']+ ' Service SubType = '+ line.record['HDSServiceSubType__c'] + ' Partner Service Capablity = ' +partnerServiceCapablity+' ]'; 
} 
//else if (districtKey in mapCustomerDiscount5Distict) { 
// obj = mapCustomerDiscount5Distict[districtKey]; 
// log = 'Partner Rules Chunk 5 Rule 4 Applied [ Geo = ' + quoteGeo + ' Product Family = '+line.record['Pricing_Product_Family__c']+ ' Service SubType = '+ line.record['HDSServiceSubType__c'] + ' Partner Service Capablity = ' +partnerServiceCapablity+' ]'; 
//} 

if (obj) { 
applyDiscountsOnLineItem(line, obj, 'Partner Rule 5', log); 
} 
else { 
remainingLines.push(line); 
} 
}); 
console.log('Remaining Lines after rule 5:' + remainingLines.length); 
var result = {"remainingLines":remainingLines,"conn":conn,"objQuote":objQuote}; 
return result; 

}).then(function(result){ 
//We will pass the remaining lines to the new set of rules 
if (result.remainingLines.length) { 
console.log('Calling rule 6 :: with ' + result.remainingLines.length); 
initPartnerDiscountRule6(result.remainingLines, result.conn, result.objQuote); 
}else{
	return Promise.resolve();
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
var productF = line.record['Pricing_Product_Family__c']; 
var pricingCat = line.record['Product_Type__c']; 
var serviceM = line.record['Pricing_Service_Model__c']; 
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
var customerSelectQuery = 'SELECT Id,Pricing_Category__c,Program_Level__c,Adjustment_Amount__c,Adjustment_Type__c,Service_Sub_Type__c,End_User_Category__c,Install_At_Country__c,Region__c,Geo__c,District__c,Product_Family__c,Product_Line__c,Service_Model__c FROM Lookup_Partner_Discount__c '; 
var whereClause = " WHERE "; 

var orConditions = ''; 
if (pricingCategory.length) { 

var pricingCategoryList = "('" + pricingCategory.join("', '") + "')"; 
if (orConditions) { 
orConditions = orConditions + ' AND ' + ' (Pricing_Category__c IN ' + pricingCategoryList + ')'; 
} 
else { 
orConditions = ' (Pricing_Category__c IN ' + pricingCategoryList + ')'; 
} 
orConditions = ' (' + orConditions + ')'; 

} 

if (productFamily.length) { 

var productFamilyList = "('" + productFamily.join("', '") + "')"; 
if (orConditions) { 
orConditions = orConditions + ' AND ' + ' (Product_Family__c IN ' + productFamilyList + ')'; 
} 
else { 
orConditions = ' (Product_Family__c IN ' + productFamilyList + ')'; 
} 
orConditions = ' (' + orConditions + ')'; 

} 

if (serviceModals.length) { 

var serviceModalsList = "('" + serviceModals.join("', '") + "')"; 
if (orConditions) { 
orConditions = orConditions + ' AND ' + ' (Service_Model__c IN ' + serviceModalsList + ')'; 
} 
else { 
orConditions = ' (Service_Model__c IN ' + serviceModalsList + ')'; 
} 
orConditions = ' (' + orConditions + ')'; 

} 
if(dateCondition){ 
if(orConditions){ 
orConditions+=' AND '; 
} 
orConditions += dateCondition; 
} 

if(orConditions){ 
orConditions+=' AND '; 
} 
orConditions += ' Pricing_Category__c !=null AND Product_Family__c!=null AND Service_Model__c!=null '; 



var query = customerSelectQuery + whereClause + orConditions; 

console.log('Partner discount rule 6: Query' + query); 

var mapCustomerDiscount6Country = {}; 
var mapCustomerDiscount6Distict = {}; 
var mapCustomerDiscount6Region = {}; 
var mapCustomerDiscount6Geo= {}; 
query = query + ' LIMIT 50000';
//Iterating over all the results that was queried for PartnerDiscount lookup and creating map 
return conn.query(query) 
.then(function(results) { 
logResultSize(results,query,'Partner Discount rule 6'); 
if (results.totalSize) { 
results.records.forEach(function(record) { 
var objValue = createObjectValue(record); 

var countryKey = ((record.Install_At_Country__c==null || record.Install_At_Country__c == '') ? record.Install_At_Country__c : record.Install_At_Country__c.toUpperCase()) + record.Product_Family__c + record.Pricing_Category__c + record.Service_Model__c; 
mapCustomerDiscount6Country[countryKey] = objValue; 

//var DistrictKey = record.District__c + record.Product_Family__c + record.Pricing_Category__c + record.Service_Model__c; 
//mapCustomerDiscount6Distict[countryKey] = objValue; 

var regionKey = record.Region__c + record.Product_Family__c + record.Pricing_Category__c + record.Service_Model__c; 
mapCustomerDiscount6Region[regionKey] = objValue; 

var geoKey = record.Geo__c + record.Product_Family__c + record.Pricing_Category__c + record.Service_Model__c; 
mapCustomerDiscount6Geo[geoKey] = objValue; 

}); 

} 
var remainingLines = []; 
lines.forEach(function(line) { 

var countryKey = installAtCountry + line.record['Pricing_Product_Family__c'] + line.record['Product_Type__c'] + line.record['Pricing_Service_Model__c']; 
var allCountryKey = WILDCARD_All + line.record['Pricing_Product_Family__c'] + line.record['Product_Type__c'] + line.record['Pricing_Service_Model__c']; 
var regionKey = quoteRegion + line.record['Pricing_Product_Family__c'] + line.record['Product_Type__c'] + line.record['Pricing_Service_Model__c']; 
var districtKey = quoteDistrict + line.record['Pricing_Product_Family__c'] + line.record['Product_Type__c'] + line.record['Pricing_Service_Model__c']; 
var geoKey = quoteGeo + line.record['Pricing_Product_Family__c'] + line.record['Product_Type__c'] + line.record['Pricing_Service_Model__c']; 

var obj; 
var log = ''; 

if (countryKey in mapCustomerDiscount6Country) { 
obj = mapCustomerDiscount6Country[countryKey]; 
log = 'Partner Rules Chunk 5 Rule 1 Applied [ Install At Country = ' + installAtCountry + ' Product Family = '+line.record['Pricing_Product_Family__c']+ ' Product Type = '+ line.record['Product_Type__c'] + ' Pricing Service Model = ' +line.record['Pricing_Service_Model__c']+' ]'; 
} 
else if (allCountryKey in mapCustomerDiscount6Country) { 
obj = mapCustomerDiscount6Country[allCountryKey]; 
log = 'Partner Rules Chunk 5 Rule 1 Applied [ Install At Country = ' + WILDCARD_All + ' Product Family = '+line.record['Pricing_Product_Family__c']+ ' Product Type = '+ line.record['Product_Type__c'] + ' Pricing Service Model = ' +line.record['Pricing_Service_Model__c']+' ]'; 
} 
else if (regionKey in mapCustomerDiscount6Region) { 
obj = mapCustomerDiscount6Region[regionKey]; 
log = 'Partner Rules Chunk 5 Rule 2 Applied [ Region = ' + quoteRegion + ' Product Family = '+line.record['Pricing_Product_Family__c']+ ' Product Type = '+ line.record['Product_Type__c'] + ' Pricing Service Model = ' +line.record['Pricing_Service_Model__c']+' ]'; 
} 
else if (geoKey in mapCustomerDiscount6Geo) { 
obj = mapCustomerDiscount6Geo[geoKey]; 
log = 'Partner Rules Chunk 5 Rule 3 Applied [ District = ' + quoteDistrict + ' Product Family = '+line.record['Pricing_Product_Family__c']+ ' Product Type = '+ line.record['Product_Type__c'] + ' Pricing Service Model = ' +line.record['Pricing_Service_Model__c']+' ]'; 
} 
//else if (districtKey in mapCustomerDiscount6Distict) { 
// obj = mapCustomerDiscount6Distict[districtKey]; 
// log = 'Partner Rules Chunk 5 Rule 4 Applied [ Geo = ' + quoteGeo + ' Product Family = '+line.record['Pricing_Product_Family__c']+ ' Product Type = '+ line.record['Product_Type__c'] + ' Pricing Service Model = ' +line.record['Pricing_Service_Model__c']+' ]'; 
//} 

if (obj) { 
applyDiscountsOnLineItem(line, obj, 'Partner Rule 6',log); 
} 
else { 
remainingLines.push(line); 
} 
}); 
console.log('We still have lines remaining after rule 6 :: ' + remainingLines.length); 

//All Partner Discount Rules applied 
}); 
}