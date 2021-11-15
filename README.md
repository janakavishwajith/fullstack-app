# Serverless Testing Practices For AWS Lambdas

This repository is a part of a M.Sc. thesis work under the CloWeE research group at Tampere University. It is a fork of a sample application created and maintained by the Serverless Framework. The purpose of this repository is to showcase the application of different automatic testing approaches for AWS Lambda applications.

The application has been modified in the following ways from the original fork:
- Converted to "traditional" Serverless Framework configuration (using AWS CloudFormation) away from Serverless Components
- Converted the API application from JavaScript to TypeScript
  - Added a few null/undefined checks to fix TS errors
  - Small improvements like using object destructuring in some places (when accessing environment variables)

The application now also features a Pulumi Infrastructure-as-Code (IaC) program for more automated deployments (under api/infrastructure directory). Tests were implemented using the Jest testing framework for unit and integration tests, and Cypress.io for E2E tests.

## Applied Testing Approaches

The repository showcases unit, integration, and system (E2E) testing applied to a full-stack application as a part of the thesis regarding this repository. The thesis studies solutions for the documented difficulties found in current scientific publications. The thesis identified three integration testing approaches by conducting a literature review on guidebooks for serverless application development; local, integration, and cloud integration testing. The Pulumi IaC application is used to overcome some difficulties regarding testing with real-world AWS cloud infrastructure. 

The tests can be found in the following directories within this repository:

| Testing approach   | Directory                    |
| ------------------ | ---------------------------- |
| Unit               | api/tests/unit               |
| Local integration  | api/tests/integration/local  |
| Hybrid integration | api/tests/integration/hybrid |
| Cloud integration  | api/tests/cloud              |
| E2E system         | api/tests/e2e                |

Additionally, the Cypress configuration is located under api/cypress directory and Jest configuration is located in the api/jest.config.js file.

## Developed test cases
The original application does not have any pre-existing tests in its original Git fork. Therefore, there were not any existing dependencies regarding testing frameworks and other tooling choices.
Therefore, we developed a complete test-suite from scratch.  The general scope of the tests is the back end serverless function, with end-to-end tests extending to the entire full-stack application. The Pulumi application and the front end application were not tested separately.

The unit test suites reached a total coverage of 100\% in all areas for the testable units. The integration test cases reached a statement coverage of 93.33\%, a branch coverage of 74.07\%, a function coverage of 100\%, and a line coverage of 100\%. The combined coverage is 100\% in all areas; refer to Appendix A for complete coverage tables.


### Unit Test

| Unit name	            	| Id Test description                                           |
| ----------------------  | ------------------------------------------------------------- |
| Registration controller |                                                               |
| U1.1		              	| Responds with status 200 OK and signed JWT on successful      |
| 			                  | registration.                                                 |
| U1.2 			              | Responds with status 400 Bad Request when user is already     |
|	  		                  | registered.		                                                |
| U1.3 			              | Responds with status 500 Internal Server Error when           |
| 			                  | Lambda environment is invalid or DynamoDB query failed.       | 
| Login controller	      |                                                               |
| U2.1			              | Responds with status 200 OK and signed JWT on successful      |
| 			                  | login.                                                        |
| U2.2			              | Responds with 404 Not Found if user is not registered.        |  
| U2.3			              | Responds with 401 Unauthorized when passwords do not          |
| 			                  | match.                                                        |
| U2.4 			              | Responds with 500 Internal Server Error when Lambda           |
| 	                  		| environment is invalid or DynamoDB query failed.              |
| User controller     		|                                                               |
| U3.1 	             		  | Responds with status 200 OK and the user information of the   |
| 	                  		| authenticated user.                                           |
| User model register   	|                                                               |
| U4.1 			              | Registers a valid user account.                               |
| U4.2		              	| Throws an error if Lambda environment is lacking.             |
| U4.3		              	| Throws an error if email or password is missing or invalid.   |
| U4.4 		               	| Throws an error if user is already registered.                |
| User model getByEmail   |                                                               |
| U5.1              			| Returns an user entity if found.                              |  
| U5.2 		              	| Returns null if the user was not found.                       |   
| U5.3 			              | Throws an error if Lambda environment is lacking.             |
| U5.4 		              	| Throws an error if email is missing or invalid.               |
| User model getById 	    |                                                               |
| U6.1 			              | Returns an user entity if found.                              |
| U6.2 			              | Returns null if user was not found.                           |
| U6.3 		              	| Throws an error if Lambda environment is lacking.             |
| U6.4 		               	| Throws an error if id is empty or missing.                    |
| User model		          |                                                               |
| convertToPublicFormat   |                                                               |
| U7.1 	              		| Converts user to a publicly displayable format.               |
| U7.2 		              	| Is able to convert any object (with the same key-values).     |
| User model		          |                                                               |
| formatUserEntity        |                                                               |
| U8.1 		              	| Parses user entity and adds id and email values to the object.|
| Utilities	            	|                                                               |
| validateEmailAddress    |                                                               |
| U9.1 			              |Returns true for valid email addresses.                        |
| U9.2 	              		|Returns false for invalid email addresses.                     |
| Utilities hashPassword  |                                                               |
| U10.1 		            	|Hashes a password correctly.                                   |
| Utilities	            	|                                                               |
| comparePassword	      	|                                                               |
| U11.1 		            	|Returns true when passwords match.                             |
| U11.2 	            		|Returns false when passwords do not match.                     |

### Integration Test

| Endpoint or functionality |Id    | Test description
| ------------------------- | ---- | ---------------------------------------------------------------------------- |
| /users/login endpoint     | I1.1 | Login succeeds (200 OK) with valid credentials of a registered user.         |
|                           | I1.2 | Login fails (404 Not Found) when user is not registered.                     |
|                           | I1.3 | Login fails (401 Unauthorized) when the given password                       |
|                           |      | does not match the registered credentials.                                   |
| /users/register endpoint  |      |                                                                              |
|                           | I2.1 | Registration succeeds (200 OK) with valid credentials.                       | 
|                           | I2.2 | Registration fails (400 Bad Request) with invalid account                    |
|                           |      | details (e.g. validation fails).                                             | 
|                           | I2.3 | Registration fails (400 Bad Request) if the email is already                 |
|                           |      | registered to an user.                                                       |
| /user endpoint (user      |      |                                                                              |
| information for front     |      |                                                                              |
| end)                      |      |                                                                              |
|                           | I3.1 | Succeeds (200 OK) when valid authorization token is included in the request. | 
|                           | I3.2 | Fails (401 Unauthorized) if the user is not registered.                      |
|                           | I3.3 | Fails (500 Internal Server Error) if the DynamoDB                            |          
|                           |      | query cannot complete                                                        |
|                           | I3.4 | Fails (401 Unauthorized) if authorization header was not                     |  
|                           |      | sent                                                                         |
|                           | I3.5 | Fails (401 Unauthorized) if the authorization token has                      |
|                           |      | been forged (unable to verify signature) or has expired                      |
| General API tests         | I4.1 | Responses include CORS (Cross Origin Resource Sharing)                       |
|                           |      | headers                                                                      |
|                           | I4.2 | API has a /test route responding with 200 OK                                 |
|                           | I4.3 | API responds with 404 Not Found to requests to undefined routes              |
## Instructions for Testing

The instructions in this file shows how to deploy the application using Pulumi and how to run the test suites. For the original instructions displaying how to deploy the application using the Serverless Framework, refer to the [original README file](README.original.md). The original process using Serverless Framework is mostly the same despite moving away from the original component implementation, though now it is only necessary to deploy the API project.

To run the program as is you will need to install [Node.js](https://nodejs.org/en/). If you wish to run cloud tests you will also need [Serverless Framework](https://www.npmjs.com/package/serverless), [AWS CLI](https://aws.amazon.com/cli/), and [Pulumi](https://www.pulumi.com/docs/get-started/aws/begin/), along with AWS and Pulumi accounts.

Before moving on, you will also need to install node modules for the project using the ```npm i``` command inside the api and site directories.

## Pulumi

Pulumi deployment can be ran manually with the following commands:
```
# If you leave out the --stack flags, Pulumi will either prompt you to select a stack or default to the previously used one.
# Deploy stack (cloud resources)
pulumi up --stack $STACK
# Destroy resources associated with the stack
pulumi destroy --stack $STACK
# Remove stack
pulumi stack rm $STACK
```

## Jest

To run all tests with Jest you can use the following command:
```npx jest```

However, as both cloud and hybrid tests deploy separate cloud environments, you might want to run tests separately. For this you can utilize regex patterns along with the Jest commands: 
```
npx jest \"tests/integration/local\|tests/unit\"
npx jest tests/integration/hybrid
npx jest tests/integration/cloud
```
If you wish to ignore the expected console prints from code, you can also pass the flag ```--silent ```to Jest.

The hybrid tests are set up to only deploy a DynamoDB instance to AWS, whereas the cloud tests will deploy the entire API excluding the front end. This means that the hybrid tests are significantly faster to run. The local tests run the fastest, as they do not require any external services.

## Cypress

To run the tests with Cypress, use the command ```npx cypress run```. You can also execute tests using the Cypress GUI using ```npx cypress open```. It's worth noting that the Cypress tests are slow to run, as especially the CloudFront deployment takes time. Also note, that contrary to the documentation, the Cypress GUI doesn't currently seem to correctly run the teardown hook for the Pulumi stack, and has to be done manually afterwards.

If you wish to deploy the environments separately beforehand, you can manually pass the CloudFront distribution endpoint to Cypress using an environment variable called ```URL``` while disabling Pulumi deployment, e.g. ```npx cypress run --env SKIP_PULUMI=true,URL=$DISTRIBUTION_URL```.
