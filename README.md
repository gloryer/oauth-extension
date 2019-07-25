# Implementation Guide


The proposed context-aware OAuth protocol has been implemented and can be found [here]. This guide walks through the overall concepts and some implementation details of the following entities: 

  - Athorization Server
  - Resource Server
  - Environmental situation oracles (ESO)
  
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
The authorization server is implemented as a node.js server, listened on port 5000 in the local computer. The implementation of AS includes four sub modules, policy engine, secure virtual resource, token generator and policy manager. 
  - **Policy engine**:  Grant or deny the request based on policies. 
  - **Secure virtual resourse**: Securely storing the polices and client's credentials.
  - **Token generator**: Generating the token once the request is permitted by policy engine.
  - **Policy manager**: Interface for Resource Owner to manage the policies at any time.
  
Two APIs are implemented on the AS,api/authorization and api/policy. 

### Policy 

This policies are accessed and managed through api/policy.  Three http request method are supported: 
  - Get - Get the list of policies.
  - Post - Create new polices.
  - Delete - Delete policies.
  
Policies are JSON objects taking the following form:

- `type`: the policy type. `simple-policy`
- `name`: A string used as an identifier or explanation for the policy.
- `content`: The content of the policy.
- `Default`: a `PolicyDecision` object indicating the default decision to be returned if the claims object does not match any of the rules in the policy. 

The `content` should be JSON object of the following form:

- `rules`: an object which maps a number of string rule IDs to rule objects (discussed below).  

A rule object must have the following form:

- `matchAnyOf`: An array of JSON objects. The rule will be activated if any of these objects _match_ the input claims, i.e. all the keys in the object also exist in the claims object and their values match.
- `decision`: the `PolicyDecision` object to return if the rule matches the claims object. 

- `context` (optional): the external context to be evaluated when client accesses resources on RS. 

A decision object must have the following form:

- `authorization`: Authorizaton decision. 
- `structuredScope`: The internal context which specifies the authorization conditions associated with the scope. 

The following example shows a sample policy: 

The rule will match any claims object which has a `client_id` key with the value `client2`. If the claims object also satisfies the structuredScope, a decision to `Permit`is returned. 

The context includes "clientlocationclinic", the context information will be included into access token and ESO tokens for RS validation 

 
```json
{   "type": "simple-policy",
    "name": "policy2",   
    "content": {
            "rules": {
                "decision": {
                    "authorization": "Permit",
                    "structuredScope": {
                        "resource_set_id": {
                            "patientId": "1000"
                        },
                        "resourceType": [
                            "Observation",
                            "Immunization"
                        ],
                        "securityLabel": [
                            "Credential"
                        ],
                        "actions": [
                            "read"
                        ]
                    }
                },
                "matchAnyOf": [
                    {
                        "client_id": "client2"
                    }
                ],
                "context": [
                    "clientlocationclinic"
                ]
            }
        },
        "Default": {
            "authorization": "Deny"
        },
    }
```

### Client Claims

Client sends http post request to api/authoriazation to obtain an access token. The request header of this request must contain the following fields:

-`grant-type `: client_credentials
-`client-assertion-type`: urn:ietf:params:oauth:client-assertion-type:jwt-bearer
-`client-assertion`: client claim token (jwt format)

Below shows an example of the claim token from client:  

```json
{
  "issuer": "client2",
  "client_id": "client2",
  "structuredScope": {
    "resource_set_id": {
      "patientId": "1000"
    },
    "resourceType": [
      "Observation",
      "Immunization"
    ],
    "securityLabel": [
      "Credential"
    ],
    "actions": [
      "read"
    ]
  }
}
```
### Authorization Evaluation 
AS will first validate all fields in the client request. The client is authenticated by creating jwt using client credentials. Then, the AS decodes the jwt token from the client and evaluates it with all the policies one by one. The evaluation leads to one result of the following for each policy:

- `Permit`: If claim objects matches one of the objects in `matchAnyof` array and requested scope in the claim object satisfies the `structuredScope` in policy.
- `Deny`: No match found in `matchAnyof` array or claim objects matches one of the objects in `matchAnyof` array but requested scope does not satisfy `structuredScope`.
- `Not Applicable`: If claim objects matches one of the objects in `matchAnyof` array but requested scope does not satisfy  `structuredScope`.

After evaluating  all the policies, a list of evaluation results will be returned. If there exists at least one `permit`, AS will grant the access and generate an access token. 

### Access Token 
AS pulls out the relavent information in the policy and embeds them in the token so that RS can verify the token without the need for token introspection. An example of the access token is shown below (after decoding) :

```json
{
  "expireIn": "1 day",
  "subject": "client1",
  "audience": "http://localhost:4990/patientrecord",
  "issuer": "http://localhost:5000/authorization",
  "structured_scope": {
    "resource_set_id": {
      "patientId": "1001"
    },
    "resourceType": [
      "Observation",
      "Immunization"
    ],
    "securityLabel": [
      "Normal"
    ],
    "actions": [
      "read"
    ]
  },
  "context": [
    "clientlocationclinic"
  ],
  "iat": 1563912226
}
```

## Resource Server 
The resource server is implemented as a node.js server, listened on port 4990 in the local computer. The token validation endpoint (api/patientrecord) is implemented at RS side. 

### Patient Data 
The patient data must be grouped by `patienId`, categoried by resourceType  and labelled with securityLabel so that RS understand authorization data in the access token.

This patient data is JSON objects taking the following form:

- `resource_set_id`: An object contains `patientId`.
- `resourceType`: A string used as the type for policy.
- `securityLabel`: Normal or Credential. 
- `content`: The content of the patient data.

The following example shows a sample patient record: 
 
```json
 {
        "resource_set_id": {
            "patientId": "1001"
        },
        "resourceType": [
            "Observation",
            "Immunization"
        ],
        "securityLabel": [
            "Normal"
        ],
        "content": {
            "time": "20190722",
            "allergies": "none",
            "result": "negative",
            "nexttreatmenttime": "20190822"
        }
    }
```

### Token Validation 

The RS verifies the signature of  the token, validiates the token content and then queries the database. The database returns the appropriate records to RS.  If context validation are required, RS sends an http post request to fetch the internal state of the ESO before releasing the resource to the client. 


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
 
