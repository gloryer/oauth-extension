# Implementation Guide


The proposed context-aware OAuth protocol has been implemented and can be found [here]. This guide walks through the overall concepts and some implementation details of the following entities: 

  - Athorization Server
  - Resource Server
  
Note that we use http as communication protocol in the implementation. 


## Tech

The implementation uses a number of open source projects/libraries to work properly:

* [React] - A JavaScript library for building user interfaces. (Client side not implemented yet)
* [Redux] -  A JavaScript library for managing App states. (Client side not implemented yet)
* [Reactstrap] - Easy to use React Bootstrap 4 components. (Client side not implemented yet)
* [MongoDB] - Cloud-based database. 
* [node.js] - evented I/O for the backend.
* [Express] - fast node.js network app framework [@tjholowaychuk].
* [Postman] - A tool for testing server APIs. 


## Authorization Server 
The authorization server is implemented as a node.js server, listened on port 5000 in the local computer. The AS provides the authorization and token generation service. We implement ABAC model for authorization and JSON web token for access token.  AS includes four endpoints, policy decision point (PDP),  policy administration point (PAP), policy information point (PIP) to control access. Once request is permitted, AS will invoke the token service to generate an access token. 

  - `policy decision point (PDP)`:  Grant or deny the request based on attributes possessed by the requester. 
  - `policy administration point (PAP)`: Interface for creating, managing and storing the policies. 
  - `policy information point (PIP)`: Provides the attribute data required for policy evaluation. 
  - `token service`: Create a jwt token which contains sufficient information of the authorization. 


### Policy Language Model 

The policy should conform the following model: 

\<`Policy`> ::=\<`Rule`> | \<`Rule`> \<`Policy`>

\<`Rule`>::= \<`SubjectAttributes`>\<`ObjectAttributes`>\<`Authorization`>\<`Obligation`>\<`EnvironmentContext`>\<`Default`> 

The `Policy` consists of a set of `Rules`. A `Rule` must have the following form: 

- `SubjectAttributes`: Attributes of the subject.
- `ObjectAttributes`: Attributes of the object. 
- `Authorization`: The result of policy evaluation.
- `Obligation`: `Obligation`  specifies the permission and the authorization conditions associated with the permission.  The authorization conditions should be performed by the policy enforcement point  in conjunction with the enforcement of an authorization decision. 
- `EnvironmentContext` (optional): The external context to be evaluated when client accesses resources on RS. 
- `Default`: Indicating the default decision  if the attributes of the requester or attibutes of the object does not match with the attibutes in `Rule`. 

### Policy Implementation

Each profile contains a separate policy repository. For example, `paymentPolicy` collection and `healthPolicy` collection. The policy collections can be  accessed and managed through API.  Three http request method are supported: 
  - Get - Get the list of policies.
  - Post - Create new polices.
  - Delete - Delete policies.

Policies are a set of rules which are JSON objects taking the following form: 

- `Type`: `"ABAC policy"`.
- `name`: Name of the policy.
- `SubjectAttributes`
- `ObjectAttributes`
- `Authorization`
- `Obligation`
- `EnvironmentContext` 
- `Default`

The following examples shows two sample rules. One for health care profile and one for payment profile. 
#### Health Care Sample Rule
All Nurse practitioners and doctors in the Cardiology Department can view the Medical Records of Heart Patient when they work at the hospital. 

 
```json
{
	"type":"ABAC policy",
	"name":"HeartPatientRecord",
	"rules":{
		"SubjectAttribute":{
			"role":["Doctor","Nurse"],
			"department":"Cardiology"
		},
		"ObjectAttribute":{
			"resourceType":["Heart"]
		},
		"authorization":"permit",
		"Obligation":{
			"actions":["view"]
		},
		"context":["clientlocationhospital"],
		"Default":{
			"authorization":"deny"
		}
	}
}
```

#### Payment Sample Rule
Client App A can one time charge $5 ON Alice's checking account for the purpose of using service provided by A. 
 
```json
{
	"type":"ABAC policy",
	"name":"client_A",
	"rules":{
		"SubjectAttribute":{
			"id":"client_A"
		},
		"ObjectAttribute":{
			"owner":"Alice",
			"account":"Checking"
		},
		"authorization":"permit",
		"Obligation":{
			"actions":["withdraw"],
			"amount":"10",
			"currency":"CAD",
			"occurance":"1"
		},
		"context":[],
		"Default":{
			"authorization":"deny"
		}
	}
}
```

### Client Claims

Client sends http post request to api/authoriazation to obtain an access token. The request header of this request must contain the following fields:

- `grant-type `: client_credentials
- `client-assertion-type`: urn:ietf:params:oauth:client-assertion-type:jwt-bearer
- `client-assertion`: client claim token (jwt format)

Below shows an example of the claim token from client:  

```json
{
  "issuer": "Nancy",
  "client_id": "1000",
  "ObjectAttribute":{
			"resourceType":["Heart"]
		},
  "structured_scope":{
			"actions":["view"]
		},
}
```
### Authorization Evaluation 
AS will first validate all fields in the client request. The client is authenticated by creating jwt using client credentials. Then, the AS decodes the jwt token from the client and evaluates it with all the policies one by one. Authorization service adopts permit-override strategy. If there exists at least one `permit`, AS will grant the access and generate an access token. 

### Access Token 
AS pulls out the relavent information in the policy and embeds them in the token so that RS can verify the token without the need of introspecting the token at AS. An example of the access token is shown below (after decoding) :

```json
{
  "expireIn": "1 day",
  "subject": "client1",
  "audience": "http://localhost:4990/patientrecord",
  "issuer": "http://localhost:5000/authorization",
  "ObjectAttribute":{
			"resourceType":["Heart"]
		},
  "Obligation":{
			"actions":["view"]
		},
  "context": [
    "clientlocationclinic"
  ],
  "iat": 1563912226
}
```

## Resource Server 
The resource server is implemented as a node.js server, listened on port 4990 in the local computer. Object attributes are typically bound to their objects through referencing,by embedding them within the object. The resources are stored in RS together with their attributes. Policy enforcement point is implemented in RS. Upon receiving the token from the client, the RS verifies the signature of  the token, validiates the token content and then queries the database. The database returns the appropriate records to RS.  If context validation are required, RS sends an http post request to fetch the internal state of the ESO before releasing the resource to the client. 

### Example of Accessing Patient Data
The RO or admistrator stores the patient data as well as the attributes in RS.  If a client possesses a valid token and required environment conditions are satisfied, RS will release all  the patient records with an attribute of "ResourceType="Heart"". 


[//]: # (These are reference links used in the body of this note and get stripped out when the markdown processor does its job. There is no need to format nicely because it shouldn't be seen. Thanks SO - http://stackoverflow.com/questions/4823468/store-comments-in-markdown-syntax)


   [dill]: <https://github.com/joemccann/dillinger>
   [git-repo-url]: <https://github.com/joemccann/dillinger.git>
   [john gruber]: <http://daringfireball.net>
   [df1]: <http://daringfireball.net/projects/markdown/>
   [markdown-it]: <https://github.com/markdown-it/markdown-it>
   [Ace Editor]: <http://ace.ajax.org>
   [node.js]: <http://nodejs.org>
   [Twitter Bootstrap]: <http://twitter.github.com/bootstrap/>
   [jQuery]: <http://jquery.com>
   [@tjholowaychuk]: <http://twitter.com/tjholowaychuk>
   [express]: <http://expressjs.com>
   [AngularJS]: <http://angularjs.org>
   [Gulp]: <http://gulpjs.com>
   [React]:<https://reactjs.org/>
   [Redux]:<https://redux.js.org/>
   [Reactstrap]: <https://reactstrap.github.io/>
   [MongoDB]: <https://www.mongodb.com/cloud/atlas>
   [here]:<https://github.com/gloryer/MERN_OAuthExtension>
   [PlDb]: <https://github.com/joemccann/dillinger/tree/master/plugins/dropbox/README.md>
   [PlGh]: <https://github.com/joemccann/dillinger/tree/master/plugins/github/README.md>
   [PlGd]: <https://github.com/joemccann/dillinger/tree/master/plugins/googledrive/README.md>
   [PlOd]: <https://github.com/joemccann/dillinger/tree/master/plugins/onedrive/README.md>
   [PlMe]: <https://github.com/joemccann/dillinger/tree/master/plugins/medium/README.md>
   [PlGa]: <https://github.com/RahulHP/dillinger/blob/master/plugins/googleanalytics/README.md>
   [Postman]: <https://www.getpostman.com/>
 
