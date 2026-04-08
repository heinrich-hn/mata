

Basic authentication
Surfsight API uses bearer authentication (also known as token authentication). When a user authenticates in order to access the Surfsight API, the authentication server generates the bearer token. This token should then be used in the Authorization header when making further requests.

You need an email address and password to get a bearer token. When you get started with Surfsight products, we send you an email containing this information.

Note
Each partner can request up to nineteen additional sets of credentials.

Note
Authentication tokens only work for the environment in which you are registered. For example, a user registered to the US cloud receives tokens for that cloud, and not the EU cloud.

To receive an authentication token:

Send the POST /authenticate request with the following structure:

curl --request POST 'https://api-prod.surfsight.net/v2/authenticate'
--header 'Content-Type: application/json'
--data-raw '{

  "email": "email@email.com",
  "password": "123Abcd!"
}'
In the request body, enter the email address and password you received from Surfsight.

An authentication token is returned. This is the authentication token you will use for subsequent requests.

Note
The returned token is valid for twenty-four hours.

In any subsequent request, include the authorization header, using the following structure:

--header 'Authorization: Bearer ImahFWLZWFdD8VVcUtIED2YuOjPFlZpldQTE5tUqKdv'

The following is an example of the GET /devices/{imei}/events request, with the token in the header.

curl --request GET https://api-prod.surfsight.net/v2/devices/{imei}/events
--header 'Content-Type: application/json'
--header 'Authorization: Bearer ImahFWLZWFdD8VVcUtIED2YuOjPFlZpldQTE5tUqKdv'


Stream and download device recordings
Video from trip recordings can be streamed and downloaded from the SD cards of your devices. Devices continuously record trips of more than 100 meters. They start recording once movement is detected by the built-in accelerometer. Audio is not played in these recordings.

By default, Surfsight devices come with a 128 GB SD card, which holds about 100 hours of video recordings. The oldest recorded file is cyclically replaced with a new recorded file once the SD card is full. Any of the recordings currently on the SD card can be streamed and downloaded.

Note
Audio is available with event videos.

Important
The device must be in "status": "standby" or "status": "online" to stream and download recordings from the SD card.

One recording file may be uploaded at a time from the device.

The rest of this guide shows you how to use the Surfsight API to stream and download recordings, including these steps:

Authenticate yourself.
Connect media.
Select a recording.
Stream the recording.
Download the recording.
1. Authenticate yourself
Authenticate yourself before making any calls with the Surfsight API. For more details on authentication, see our authentication overview.

2. Connect media
Receive the authentication token and media server address to retrieve a recording or live video with the POST /devices/{imei}/connect-media request.

    curl --request POST https://api-prod.surfsight.net/v2/devices/{imei}/connect-media
    --header 'Content-Type: application/json'
    --header 'Authorization: Bearer {token}'
Returned response:

{
    "data": {
        "address": "prodmedia-us-05.surfsolutions.com",
        "mediaToken": "0e5d4dfb-56fe-4271-b9c8-86e4d7f214d5"
    }
 }
Note
The token is valid for thirty minutes.

3. Select a recording
Receive a list of available recordings from every camera of your device in the desired time range with the GET /devices/{imei}/recording-ranges request.

curl --request GET https://api-prod.surfsight.net/v2/devices/{imei}/recording-ranges?start={start}&end={end}
--header 'Content-Type: application/json'
--header 'Authorization: Bearer {token}'
Component	Description	Example
imei	The IMEI number of the device from which you are uploading recordings.	357660101000198
start	Filter by a start date and time, in ISO 8601 format.	start=2020-01-01T14:48:00.000Z
end	Filter by an end date and time, in ISO 8601 format.	end=2020-01-01T15:48:00.000Z
Returned response:

{
    "data": [
        {
            "cameraId": 1,
            "intervals": [
                {
                    "start": "2021-10-15T15:06:35.000Z",
                    "end": "2021-10-15T15:34:38.000Z"
                },
                {
                    "start": "2021-10-16T08:19:46.000Z",
                    "end": "2021-10-16T09:13:56.000Z"
                },
                {
                    "start": "2021-10-16T10:17:32.000Z",
                    "end": "2021-10-16T12:19:52.000Z"
                }
            ]
            },
        {
            "cameraId": 2,
            "intervals": [
                {
                    "start": "2021-10-15T15:06:35.000Z",
                    "end": "2021-10-15T15:34:38.000Z"
                },
                {
                    "start": "2021-10-16T08:19:46.000Z",
                    "end": "2021-10-16T09:13:56.000Z"
                },
                {
                    "start": "2021-10-16T10:17:32.000Z",
                    "end": "2021-10-16T12:19:52.000Z"
                }
            ]
        }
    ]
}
Note
Enter the time range in ISO 8601 format.

Note
If "data": [] is returned empty, this indicates that there are no recordings on the SD card for the selected time range.

4. Stream the recording
Enter the following URL in the source tag of the video tag in an HTML5 video player to stream the recording: https://{mediaServerAddress}/rec/{imei}/{cameraId}/{mediaToken}/{startTime}/{videoDuration}/{qualityLevel}/rec.mp4

Attention
Use the following headers with GET reqeust: {"range": "bytes=0-*", "accept": "*/*"} to upload the recordings without the use of the browser's video player.

When creating the URL to stream the recordings, use the following strings that were aquired from the steps above:

Component	Description	Example
mediaServerAddress	The server received in step 2.	prodmedia-us-05.surfsolutions.com
mediaToken	The media token received in step 2.	0e5d4dfb-56fe-4271-b9c8-86e4d7f214d5
imei	The IMEI number of the device from which you are uploading recordings.	357660101000198
cameraId	The ID of the camera from which you want a recording (1 - road-facing camera, 2 - in-cabin-facing camera, 51 to 54 - auxiliary cameras).	2
startTime	The start time of the recording you want to receive, in UNIX. Convert the time received in Step 3 from ISO 8601 to UNIX.	1634091790
videoDuration	The length of time of the recording you want to receive, in seconds.	60
quality	Select one of the following recording quality options when uploading the video:
high quality (hq) - recordings play in the frames per second configured in your data profile.
low quality (lq) - recordings play in 1 frame per second
.	lq
5. Download the recording
Enter the following URL into a web browser or create a hyperlink with it to download the recording file: https://{mediaServerAddress}/download/{imei}/{mediaToken}/{imei}_{cameraId}_{startTime}_{videoDuration}_{qualityLevel}.mp4

When creating the URL to download the recordings, use the strings that were aquired from the steps above.

Note
The recording is available to download for one hour after it was streamed in step 4.



{
  "openapi": "3.0.0",
  "servers": [
    {
      "url": "https://api-prod.surfsight.net/{apiVersion}",
      "description": "Surfsight US API Gateway",
      "variables": {
        "apiVersion": {
          "default": "v2",
          "enum": [
            "v2"
          ]
        }
      }
    },
    {
      "url": "https://api.de.surfsight.net/{apiVersion}",
      "description": "Surfsight DE API Gateway",
      "variables": {
        "apiVersion": {
          "default": "v2",
          "enum": [
            "v2"
          ]
        }
      }
    }
  ],
  "info": {
    "version": "2.0.0",
    "title": "Surfsight API",
    "contact": {
      "email": "developer-surfsight@surfsight.com"
    },
    "description": "# Authentication\n\n<!-- ReDoc-Inject: <security-definitions> -->"
  },
  "tags": [
    {
      "name": "Alarms",
      "description": "Manage your alarms, retrieve alarms reports, and set email notifications. Alarms let you know when devices are not working properly, and recommend the best course of action to fix them."
    },
    {
      "name": "Audit logs",
      "description": "Retrieve the audit logs of an organization. Audit logs provide visibility into your data."
    },
    {
      "name": "Authentication",
      "description": "Authenticate users to access the API. Authentication helps to secure your networks and resources."
    },
    {
      "name": "Calibration",
      "description": "Configure and manage auto-calibration settings for AI-12 devices. Auto-calibration enables automated ADAS calibration functionality to ensure optimal device performance and accuracy of safety features."
    },
    {
      "name": "Device Operations",
      "description": "Manage your device operations, such as formatting SD cards and retrieving data usage."
    },
    {
      "name": "Devices",
      "description": "Manage your devices and retrieve data about your devices, such as a device's settings or active cameras."
    },
    {
      "name": "Drivers",
      "description": "Add and manage your drivers."
    },
    {
      "name": "Events",
      "description": "Configure event settings and retrieve data about your events, such as event settings or an event's details. Events are any of a number of risky incidents that can occur during a trip, such as acceleration, violent turns, or distracted driving. Events can be configured to upload as text, snapshots, or videos. Video events capture 5 seconds before and after the event occurs. The data tracked for each event includes the type of event, the date and time of the event, the location of the event, and the speed of the vehicle during the event."
    },
    {
      "name": "Geofences",
      "description": "Set geofences and retrieve a list of a device's geofences. A geofence defines a geographic boundary, as determined by the GPS technology. Setting a geofence triggers an event when the vehicle enters or exits the defined area."
    },
    {
      "name": "Groups",
      "description": "Create and manage groups. Devices can be consolidated within a single group. Once you configure a group and associate any devices, you can then centrally manage those devices at the group level."
    },
    {
      "name": "Health",
      "description": "Retrieve health reports and set email notifications. Health reports help you keep track of healthy and unhealthy devices."
    },
    {
      "name": "OAuth Clients",
      "description": "Create and manage OAuth clients for API authentication. OAuth clients enable secure machine-to-machine authentication for partners and subpartners to access Surfsight APIs systematically."
    },
    {
      "name": "OAuth Token Operations",
      "description": "OAuth 2.0 token lifecycle operations including token generation, validation, and introspection. Use these endpoints to obtain access tokens and verify token validity."
    },
    {
      "name": "Organizations",
      "description": "Create and manage organizations. Individual devices and groups can be consolidated within a single organization. Once you configure an organization and associate any devices or groups, you can then centrally manage those devices and groups at the organization level."
    },
    {
      "name": "Partner Operation Statistics",
      "description": "Enable partners to view statistics about their devices and organizations, such as the number of activated devices and the number of alarms associated with their organizations in the past few weeks or months."
    },
    {
      "name": "Partners",
      "description": "Enable partners to manage their contacts. Partner contacts are representatives of the partner, with partner-level permissions."
    },
    {
      "name": "Recordings",
      "description": "Retrieve data about recordings availability for a device's cameras and snapshots of a camera's current view. Recordings are taken during trips from all cameras associated with a device (the road-facing lens, the in-cabin lens, and any auxiliary cameras). The video is saved to the SD card and uploaded to the cloud."
    },
    {
      "name": "Streaming",
      "description": "Prepare live streaming from a device. With live streaming, you can see the view from your device's cameras in real-time."
    },
    {
      "name": "Telemetry",
      "description": "Retrieve telemetry data from a device or camera, such as data about the SIM and SD cards and the status of the camera or device."
    },
    {
      "name": "Users",
      "description": "Create and manage users. Users can have various permissions assigned to them: <ul>Administrator: The user has full access to the system. The user can view, create or modify any object (device, group, users, settings) in the system</ul> <ul>Supervisor: The user has the same clearance as the administrator, but cannot add, modify or remove users</ul> <ul>User: The user has full access to the system, but cannot add new devices or create new groups</ul> <ul>Restricted: The user is defined in the system but cannot login</ul> <ul>User - Map Viewer: The user only has access to the Maps tab. The user can view live location and trip history, but without any event data. The user cannot use any API endpoints.</ul>"
    },
    {
      "name": "Virtual Event",
      "description": "Generate third-party events from the existing recordings and data of your device."
    },
    {
      "name": "Webhooks",
      "description": "Manage your webhooks subscriptions. Webhooks are automated messages sent from apps when an event occurs. They contain data and commands sent over HTTP. Surfsight makes an HTTP request to the URL you configure for your webhook. This request contains GPS data or data about events, often with snapshots or videos attached."
    },
    {
      "name": "Organization Album",
      "description": "Manage your organization's album. An album is a collection of snapshots taken from devices within an organization, grouped together by images of drivers in an organization."
    }
  ],
  "paths": {
    "/authenticate": {
      "post": {
        "tags": [
          "Authentication"
        ],
        "description": "Authenticate the user prior to making other API calls. Insert the bearer token obtained from this call in all other API calls in the HTTPS header in the form of authorization\\: bearer {token}. The token is valid for twenty-four hours.",
        "summary": "Authenticate users",
        "operationId": "postAuthenticate",
        "requestBody": {
          "$ref": "#/components/requestBodies/postAuthenticate"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postAuthenticate"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/scoped-token": {
      "post": {
        "tags": [
          "Authentication"
        ],
        "description": "A new /scoped-token API authenticates users via bearer token and generates a scoped JWT, limiting the access of content to specified entities (device, devices in a group, and all devices in an organization) for a duration of 24 hours. This token, included in the Authorization header of subsequent API calls, functions as a bearer token, and grants access only to APIs within the defined scope. This allows partners and sub-partners to restrict user access to reusable components like Event Media, Live Streaming, and Recording Timeline. <br><br>For example, to enable viewing event media from the event-media component, create a token for the deviceEvent component. However, to enable the retrieval of videos from the camera, create a token that enables both the deviceEvent and deviceRecordingTimeline components from the event-media component.",
        "summary": "Scoped Token Authentication for Granular API Access",
        "operationId": "postScopedToken",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postScopedToken"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postScopedToken"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/oauth/clients/{entityType}/{entityId}": {
      "post": {
        "tags": [
          "OAuth Clients"
        ],
        "description": "Create a new OAuth client for a partner or subpartner. This endpoint allows partners to generate OAuth credentials for API authentication.",
        "summary": "Create OAuth Client",
        "operationId": "createClient",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/oAuthEntityTypePath"
          },
          {
            "$ref": "#/components/parameters/oAuthEntityIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/createOAuthClient"
        },
        "responses": {
          "201": {
            "$ref": "#/components/responses/createOAuthClientResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "409": {
            "description": "Client mapping already exists"
          },
          "429": {
            "description": "Rate limit exceeded - max clients per partner or user reached"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/oauth/clients": {
      "get": {
        "tags": [
          "OAuth Clients"
        ],
        "description": "List all OAuth clients for the authenticated partner",
        "summary": "List OAuth Clients",
        "operationId": "getClients",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getOAuthClientsResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/oauth/clients/{clientId}": {
      "get": {
        "tags": [
          "OAuth Clients"
        ],
        "description": "Get details of a specific OAuth client by ID",
        "summary": "Get OAuth Client Details",
        "operationId": "getClientById",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/oAuthClientIdPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getOAuthClientByIdResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "patch": {
        "tags": [
          "OAuth Clients"
        ],
        "description": "Enable or disable an OAuth client",
        "summary": "Update OAuth Client Status",
        "operationId": "updateClient",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/oAuthClientIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/updateOAuthClientStatus"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/updateOAuthClientStatusResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "delete": {
        "tags": [
          "OAuth Clients"
        ],
        "description": "Delete an OAuth client permanently",
        "summary": "Delete OAuth Client",
        "operationId": "deleteClient",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/oAuthClientIdPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/deleteOAuthClientResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/oauth/clients/{clientId}/secret": {
      "put": {
        "tags": [
          "OAuth Clients"
        ],
        "description": "Rotate the client secret for an OAuth client. The old secret will be invalidated.",
        "summary": "Rotate Client Secret",
        "operationId": "rotateClientSecret",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/oAuthClientIdPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/rotateClientSecretResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/oauth/token": {
      "post": {
        "tags": [
          "OAuth Token Operations"
        ],
        "description": "Generate an access token using OAuth 2.0 Client Credentials Flow. This is a standard OAuth 2.0 token endpoint for machine-to-machine authentication.",
        "summary": "Generate Access Token",
        "operationId": "generateAccessToken",
        "requestBody": {
          "$ref": "#/components/requestBodies/generateAccessToken"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/generateAccessTokenResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/oauth/introspect": {
      "post": {
        "tags": [
          "OAuth Token Operations"
        ],
        "description": "Validate an OAuth token and retrieve its claims. This is a standard OAuth 2.0 introspection endpoint.",
        "summary": "Introspect OAuth Token",
        "operationId": "introspectToken",
        "requestBody": {
          "$ref": "#/components/requestBodies/introspectToken"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/introspectTokenResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "description": "Invalid credentials"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/forget-password/{email}": {
      "post": {
        "tags": [
          "Users"
        ],
        "description": "Request an email with a token to reset your password.",
        "summary": "Forgot password",
        "operationId": "postForgotPassword",
        "parameters": [
          {
            "$ref": "#/components/parameters/emailPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/postForgotPassword"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/reset-password/{token}": {
      "post": {
        "tags": [
          "Users"
        ],
        "description": "Reset the password of an unauthenticated user. Use the token received from the forgot password email.",
        "summary": "Reset password",
        "operationId": "postResetPassword",
        "parameters": [
          {
            "$ref": "#/components/parameters/tokenPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postResetPassword"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postResetPassword"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/users/{userId}/change-password": {
      "post": {
        "tags": [
          "Users"
        ],
        "description": "For authenticated users to change their password. The password of the user with the authentication token is changed.",
        "summary": "User-Initiated Password Change",
        "operationId": "postChangePassword",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/userIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postChangePassword"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postChangePassword"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/users/update-settings": {
      "put": {
        "tags": [
          "Users"
        ],
        "description": "Change a user's regional settings for the cloud, such as the measurement units and time format. <br><br>Note: PUT calls update data entirely. Any data not mentioned in the call, will be deleted.",
        "summary": "Change user settings",
        "operationId": "putUserSettings",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/putUserSettings"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/putUserSettings"
          }
        }
      }
    },
    "/users/{userId}": {
      "delete": {
        "tags": [
          "Users"
        ],
        "description": "Delete a user.",
        "summary": "Delete user",
        "operationId": "deleteUser",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/userIdPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/deleteUser"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/users/{userId}/organizations/{orgId}/permissions": {
      "patch": {
        "tags": [
          "Users"
        ],
        "description": "Set the permissions for a user of an organization.<br><b>Note:</b> This API call  replaces the role and userAccessDashCamGroups fields with new values. If a userAccessPermission record already exists, it is replaced with the new values; otherwise, a new record is created.",
        "summary": "Set user permissions",
        "operationId": "patchUserOrganizationPermissions",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/userIdPath"
          },
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/patchUserOrganizationPermissions"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/patchUserOrganizationPermissions"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations/{orgId}/bulk-devices": {
      "post": {
        "tags": [
          "Devices"
        ],
        "description": "Add devices in bulk. <br><br>Note: POST calls create new data, and do not affect existing data.",
        "summary": "Bulk add devices",
        "operationId": "postBulkDevices",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postBulkDevices"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postBulkDevices"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations/{orgId}/partner-bulk-devices": {
      "put": {
        "tags": [
          "Devices"
        ],
        "description": "Add multiple devices to an organization. Only partners can make this call. If a device already belongs to an organization, this call will not add it to another organization, nor update its name/groupId.",
        "summary": "Bulk add devices - partners only",
        "operationId": "bulkAssignDevicesToOrganizationForPartner",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postBulkDevices"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postBulkDevices"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/device-config": {
      "put": {
        "tags": [
          "Devices"
        ],
        "description": "Set device settings in bulk, such as turning the in-cabin facing camera or distracted driver functionality on/off. Provide a list of IMEIs or group IDs. <br><br>Note: PUT calls update data entirely. Any data not mentioned in the call, will be deleted.",
        "summary": "Bulk configure devices",
        "operationId": "putBulkDeviceConfig",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/putBulkDeviceConfig"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/putDeviceConfig"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations/{orgId}/devices/{imei}": {
      "delete": {
        "tags": [
          "Devices"
        ],
        "description": "Delete a device from an organization.",
        "summary": "Delete device",
        "operationId": "deleteOrganizationDevices",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          },
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/deleteOrganizationDevices"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations/{orgId}/devices": {
      "post": {
        "tags": [
          "Devices"
        ],
        "description": "Add a device to an organization.<br><br>Note: POST calls create new data, and do not affect existing data.",
        "summary": "Add device",
        "operationId": "postOrganizationDevices",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postOrganizationDevices"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postOrganizationDevices"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "409": {
            "$ref": "#/components/responses/conflictError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "get": {
        "tags": [
          "Devices"
        ],
        "description": "Retrieve a list of all the devices associated with an organization. This API gets the device status and the  liveVideoTimeoutSeconds parameter, which is required before displaying the live stream. The data returned from this API will be limited to the type of access associated with the token. If the token is bound to the  IMEI level, then this API will only return  the data for the IMEI.",
        "summary": "Retrieve organization devices",
        "operationId": "getOrganizationDevices",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          },
          {
            "$ref": "#/components/parameters/groupIdQuery"
          },
          {
            "$ref": "#/components/parameters/nameQuery"
          },
          {
            "$ref": "#/components/parameters/imeiQuery"
          },
          {
            "$ref": "#/components/parameters/locatedQuery"
          },
          {
            "$ref": "#/components/parameters/limitQueryMax1500WithDefaultValue1500"
          },
          {
            "$ref": "#/components/parameters/offsetQueryMin0"
          },
          {
            "$ref": "#/components/parameters/getTelemetryDataQuery"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getOrganizationDevices"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/associated-devices": {
      "post": {
        "tags": [
          "Devices"
        ],
        "description": "Retrieve the IDs of third-party devices associated with your devices.",
        "summary": "Retrieve associated devices",
        "operationId": "postAssociatedDevices",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postAssociatedDevices"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postAssociatedDevices"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "417": {
            "$ref": "#/components/responses/expectationFailedError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations/{orgId}/devices/calibrate-accelerometer": {
      "post": {
        "tags": [
          "Device Operations"
        ],
        "description": "Calibrate single or multiple device accelerometers remotely. The devices must be online or in standby mode.",
        "summary": "Calibrate accelerometers",
        "operationId": "postOrganizationDevicesCalibrateAccelerometer",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postOrganizationDevicesCalibrateAccelerometer"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postOrganizationDevicesCalibrateAccelerometer"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/otg-settings": {
      "post": {
        "tags": [
          "Device Operations"
        ],
        "description": "Enable or disable USB on-the-go (OTG) for a device. When OTG is enabled, the USB port of the device is enabled. The device must be connected to the cloud service.",
        "summary": "Enable USB on-the-go (OTG) for device",
        "operationId": "postDeviceOtgSettings",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/postDeviceOtgSettings"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "417": {
            "$ref": "#/components/responses/expectationFailedError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/adas-calibration-images": {
      "get": {
        "tags": [
          "Device Operations"
        ],
        "description": "Retrieve the ADAS calibration images saved in the device. The device must be online or in standby mode.<br><br> Step 1: Call this endpoint with the \"max\" parameter. When the \"max\" parameter is provided the API will fetch the maximum images from the device and start uploading them to S3.<br> Step 2: Wait ten minutes. <br> Step 3: Call this endpoint without the \"max\" parameter. When the \"max\" parameter is not provided the API will not fetch images from the device but will return the last 10 images uploaded by the device.<br>",
        "summary": "Retrieve ADAS images",
        "operationId": "getAdasCalibrationImages",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          },
          {
            "$ref": "#/components/parameters/maximumAdasCalibrationImagesQuery"
          },
          {
            "$ref": "#/components/parameters/calibrateTypeQuery"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getAdasCalibrationImages"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/adas-delete-calibration-images": {
      "delete": {
        "tags": [
          "Device Operations"
        ],
        "description": "Delete the ADAS calibration images saved on the device. The device must be online or in standby mode. New calibration images are added next time the vehicle is driven at above 75 km/h.",
        "summary": "Delete ADAS images",
        "operationId": "deleteAdasCalibrationImages",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/deleteAdasCalibrationImages"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/format-storage": {
      "get": {
        "tags": [
          "Device Operations"
        ],
        "description": "Format the device SD card. The device must be connected to the cloud service. If you have auxiliary cameras paired to your device, those SD cards are also formatted.",
        "summary": "Format SD card",
        "operationId": "getDeviceFormatStorage",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDeviceFormatStorage"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "417": {
            "$ref": "#/components/responses/expectationFailedError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/reboot": {
      "post": {
        "tags": [
          "Device Operations"
        ],
        "description": "Reboot the device. The device must be connected to the cloud service.",
        "summary": "Reboot device",
        "operationId": "postDeviceReboot",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/postDeviceReboot"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/factory-reset": {
      "post": {
        "tags": [
          "Device Operations"
        ],
        "description": "Reset the device to factory settings. The device must be online or in standby mode. If the device is offline, it resets when it comes back online.<br><br> The following revert back to default:<br> <ul>device settings</ul> <ul>privacy settings</ul> <ul>retention settings</ul> <ul>recording encryption settings</ul> <ul>accelerometer calibration settings</ul> <ul>ADAS calibration settings</ul> <ul>data profiles</ul> <ul>custom APNs</ul><br><br> Partners and organization admins can make this call.",
        "summary": "Reset device",
        "operationId": "postFactoryReset",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/postFactoryReset"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/rma-devices": {
      "get": {
        "tags": [
          "Devices"
        ],
        "description": "Retrieve a list of RMA devices.",
        "summary": "Retrieve a list of RMA devices",
        "operationId": "getRmaDevices",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/deviceNameQuery"
          },
          {
            "$ref": "#/components/parameters/imeiQuery"
          },
          {
            "$ref": "#/components/parameters/limitQuery"
          },
          {
            "$ref": "#/components/parameters/offsetQuery"
          },
          {
            "$ref": "#/components/parameters/orderQuery"
          },
          {
            "$ref": "#/components/parameters/organizationNameQuery"
          },
          {
            "$ref": "#/components/parameters/rmaUpdatedAtStartQuery"
          },
          {
            "$ref": "#/components/parameters/rmaUpdatedAtEndQuery"
          },
          {
            "$ref": "#/components/parameters/rmaDeviceSortQuery"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getRmaDevicesResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/auto-recalibrate": {
      "post": {
        "tags": [
          "Calibration"
        ],
        "description": "Recalibrate the device ADAS parameters. The device must be online or in standby mode in order to recalibrate.",
        "summary": "Re-calibrate device",
        "operationId": "postAutoRecalibration",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/RecalibrationRequest"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postAutoReCalibration"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/auto-calibration/config": {
      "post": {
        "tags": [
          "Calibration"
        ],
        "description": "Enable or disable the auto-calibration feature at the partner, organization, or device level. By default, auto-calibration is disabled. When enabled, activates ADAS calibration functionality for AI-12 devices.",
        "summary": "Configure auto-calibration",
        "operationId": "postAutoCalibrationConfig",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postAutoCalibrationConfig"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postAutoCalibrationConfig"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/wakeup": {
      "post": {
        "tags": [
          "Device Operations"
        ],
        "description": "Wake the device up from standby mode.",
        "summary": "Wake up device",
        "operationId": "postWakeupDevice",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/postWakeupDevice"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/semi-online": {
      "put": {
        "tags": [
          "Device Operations"
        ],
        "description": "Set the device to semi online mode (AI-14)",
        "summary": "Set the device to semi online mode (AI-14)",
        "operationId": "putDeviceSemiOnline",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/putDeviceSemiOnline"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/demo-mode": {
      "put": {
        "tags": [
          "Device Operations"
        ],
        "description": "Set the device to demo mode (AI-14)",
        "summary": "Set the device to demo mode (AI-14)",
        "operationId": "putDeviceInDemoMode",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/putDeviceInDemoMode"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "delete": {
        "tags": [
          "Device Operations"
        ],
        "description": "Take the device out of demo mode",
        "summary": "Take the device out of demo mode",
        "operationId": "deleteDeviceFromDemoMode",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/deleteDeviceFromDemoMode"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/data-usage": {
      "get": {
        "tags": [
          "Device Operations"
        ],
        "description": "Retrieve the data usage of the device.",
        "summary": "Retrieve device data usage",
        "operationId": "getDeviceDataUsage",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDeviceDataUsage"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/bulk-data-usage": {
      "post": {
        "tags": [
          "Device Operations"
        ],
        "description": "Retrieve the data usage of a list of devices.",
        "summary": "Retrieve devices data usage",
        "operationId": "getDevicesDataUsage",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/getDevicesDataUsage"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDevicesDataUsage"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/cameras": {
      "get": {
        "tags": [
          "Devices"
        ],
        "description": "Retrieve a list of views available for live streaming from a device.<br><br> 1 - road-facing, 2 - in-cab, 50+ - auxiliary camera views.<br><br> The device/s must be online.",
        "summary": "Retrieve active cameras",
        "operationId": "getDeviceCameras",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDeviceCameras"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "417": {
            "$ref": "#/components/responses/expectationFailedError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "patch": {
        "tags": [
          "Device Operations"
        ],
        "description": "Update the name of an auxiliary camera. <br><br>Note: PATCH calls update data partially. Any data not mentioned in the call, will be kept as is.",
        "summary": "Update auxiliary camera name",
        "operationId": "patchDeviceCameras",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/patchDeviceCameras"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/patchDeviceCameras"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/pin-codes": {
      "post": {
        "tags": [
          "Devices"
        ],
        "description": "Retrieve driver and admin PIN codes of a device.",
        "summary": "Retrieve device PIN codes",
        "operationId": "getDevicePinCodes",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/getDevicePinCodes"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDevicePinCodes"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/generate-encryption-key": {
      "put": {
        "tags": [
          "Devices"
        ],
        "description": "Get a randomly generated, strong, 32-characters encryption key",
        "summary": "Get a randomly generated encryption key",
        "operationId": "generateEncryptionKey",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getEncryptionKeyResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/recording-encryption-keys": {
      "get": {
        "tags": [
          "Devices"
        ],
        "description": "Retrieve the recording encryption keys for a device.",
        "summary": "Retrieve device recording encryption keys",
        "operationId": "getDeviceRecordingEncryptionKeys",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDeviceRecordingEncryptionKeysResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/device-config": {
      "get": {
        "tags": [
          "Devices"
        ],
        "description": "Retrieve a list of the device settings.",
        "summary": "Retrieve device settings",
        "operationId": "getDeviceConfig",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDeviceConfig"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "put": {
        "tags": [
          "Devices"
        ],
        "description": "Update the device settings.<br><br>Note: PUT calls update data entirely. Any data not mentioned in the call, will be deleted.",
        "summary": "Update device settings",
        "operationId": "putDeviceConfig",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/putDeviceConfig"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/putDeviceConfig"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/calibrate-adas": {
      "put": {
        "tags": [
          "Devices"
        ],
        "description": "Update the device ADAS calibration parameters.<br><br>Note: PUT calls update data entirely. Any data not mentioned in the call, will be deleted.",
        "summary": "Update device ADAS calibration",
        "operationId": "putCalibrateAdas",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/putCalibrateAdas"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/putCalibrateAdas"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "post": {
        "tags": [
          "Devices"
        ],
        "description": "This call is currently in beta; contact your Technical Account Manager for more information.<br><br>Calibrate ADAS for a device automatically. The device takes about ten minutes to calibrate.<br>The device must: <ul>be online</ul> <ul>not already be in a calibration process</ul> <ul>have version 3.10 or above</ul> <ul>have calibration images available</ul>",
        "summary": "Calibrate ADAS",
        "operationId": "postAutoAdasCalibration",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/putCalibrateAdas"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "get": {
        "tags": [
          "Devices"
        ],
        "description": "Retrieve the ADAS calibration status(only for AI-14 with version >= 14.4)",
        "summary": "Retrieve the ADAS calibration status(AI-14)",
        "operationId": "getNewCalibrateAdasStatus",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getNewCalibrateAdasStatus"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/calibrate-adas/state": {
      "get": {
        "tags": [
          "Devices"
        ],
        "description": "This call is currently in beta; contact your Technical Account Manager for more information.<br><br>Retrieve the ADAS calibration state. ADAS calibration takes about ten minutes.",
        "summary": "Retrieve ADAS calibration state",
        "operationId": "getAutoAdasCalibrationState",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getCalibrateAdasState"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/auto-calibration/status": {
      "get": {
        "tags": [
          "Calibration"
        ],
        "description": "Retrieves the auto-calibration status for a device. This endpoint returns the current status and the type of auto-calibration process",
        "summary": "Retrieves the auto-calibration status",
        "operationId": "getAutoCalibrationStatus",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getAutoCalibrationStatus"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/tailgating-event-mute/configure": {
      "post": {
        "tags": [
          "Devices"
        ],
        "description": "Configure the mute period for tailgating safety alerts on the specified devices.Tailgating detections within the configured interval will not generate additional alerts or notifications.",
        "summary": "Configure tailgating  mute period for devices",
        "operationId": "configureMutePeriod",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "entityType",
                  "entityValues",
                  "coolOffDuration"
                ],
                "properties": {
                  "entityType": {
                    "type": "string",
                    "description": "Type of entity to configure (device)",
                    "enum": [
                      "device"
                    ],
                    "example": "device"
                  },
                  "entityValues": {
                    "type": "array",
                    "description": "Array of entity IDs (device serial numbers)",
                    "maxItems": 100,
                    "items": {
                      "type": "string"
                    },
                    "example": [
                      "357660101045003"
                    ]
                  },
                  "coolOffDuration": {
                    "type": "integer",
                    "description": "Cool-off period in minutes between consecutive tailgating events (must be between 10 and 480)",
                    "minimum": 10,
                    "maximum": 480,
                    "example": 300
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/defaultSuccessResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/data-profile/{dataProfileId}": {
      "put": {
        "tags": [
          "Devices"
        ],
        "description": "Set the device data profile. For more information, see [Data profile options](https://developer.surfsight.net/developer-portal/data-profiles/). <br><br>Note: PUT calls update data entirely. Any data not mentioned in the call, will be deleted.",
        "summary": "Set the device data profile",
        "operationId": "putDeviceDataProfile",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          },
          {
            "$ref": "#/components/parameters/dataProfileIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/putDeviceDataProfile"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/defaultSuccessResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/wifi-password": {
      "post": {
        "tags": [
          "Devices"
        ],
        "description": "Retrieve the wi-fi password for a single device or multiple devices. Only partners can make this call.<br>The device must:<ul>have version 3.12.202 or above</ul>",
        "summary": "Retrieve the wi-fi password for a device or devices",
        "operationId": "postDeviceWifiPassword",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postDeviceWifiPassword"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postDeviceWifiPasswordResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/billing-status": {
      "get": {
        "tags": [
          "Devices"
        ],
        "description": "Retrieve the device billing status. Only partners can make this call.",
        "summary": "Retrieve the device billing status",
        "operationId": "getDeviceBillingStatus",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDeviceBillingStatusResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/billing-status/{billingStatus}": {
      "put": {
        "tags": [
          "Devices"
        ],
        "description": "Set the device billing status. Only partners can make this call. Changing the billing status may result in additional fees. For more information contact your partner success manager. <br><br>Note: PUT calls update data entirely. Any data not mentioned in the call, will be deleted.",
        "summary": "Set the device billing status",
        "operationId": "putDeviceBillingStatus",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          },
          {
            "$ref": "#/components/parameters/billingStatusPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/putDeviceBillingStatus"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/defaultSuccessResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/billing-status/{billingStatus}": {
      "put": {
        "tags": [
          "Devices"
        ],
        "description": "Set bulk devices billing status. Only partners can make this call. Changing the billing status may result in additional fees. For more information contact your partner success manager. <br><br>Note: PUT calls update data entirely. Any data not mentioned in the call, will be deleted.",
        "summary": "Set bulk devices billing status",
        "operationId": "putBulkDevicesBillingStatus",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/billingStatusPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/putBulkDevicesBillingStatus"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/putBulkDevicesBillingStatusResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/data-profile/{dataProfileId}": {
      "put": {
        "tags": [
          "Devices"
        ],
        "description": "Set bulk devices data profile. For more information, see [Data profile options](https://developer.surfsight.net/developer-portal/data-profiles/). <br><br>Note: PUT calls update data entirely. Any data not mentioned in the call, will be deleted.",
        "summary": "Set bulk devices data profile",
        "operationId": "putBulkDevicesDataProfile",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/dataProfileIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/putBulkDevicesDataProfile"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/defaultSuccessResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}": {
      "get": {
        "tags": [
          "Devices"
        ],
        "description": "Retrieve the device metadata. Only partners and administrators can make this call.",
        "summary": "Retrieve device metadata",
        "operationId": "getDevice",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDevice"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "patch": {
        "tags": [
          "Devices"
        ],
        "description": "Update a device and its various properties.<br><br>Note: PATCH calls update data partially. Any data not mentioned in the call, will be kept as is.",
        "summary": "Update device",
        "operationId": "patchDevice",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/patchDevice"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/patchDevice"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/privacy-control": {
      "post": {
        "tags": [
          "Devices"
        ],
        "description": "This call is currently in BETA. Contact your Technical Account Manager for more information.<br><br> Set bulk devices privacy mode.",
        "summary": "Set bulk devices privacy mode (BETA)",
        "operationId": "postBulkDevicesPrivacyMode",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postBulkDevicesPrivacyModeObject"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/defaultMultiResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/privacy-control": {
      "get": {
        "tags": [
          "Devices"
        ],
        "description": "This call is currently in BETA. Contact your Technical Account Manager for more information.<br><br> Retrieve privacy mode of a single device.",
        "summary": "Retrieve privacy mode of a single device (BETA)",
        "operationId": "getDevicePrivacyMode",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/GetBulkPrivacyControlObject"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations": {
      "post": {
        "tags": [
          "Organizations"
        ],
        "description": "Create a new organization. Only partners can make this call.<br><br>Note: POST calls create new data, and do not affect existing data.",
        "summary": "Create organization",
        "operationId": "postOrganization",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postOrganization"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postOrganization"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "get": {
        "tags": [
          "Organizations"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "description": "Retrieve a list of the organizations belonging to the current authenticated entity.",
        "summary": "Retrieve list of organizations",
        "operationId": "getOrganizations",
        "responses": {
          "200": {
            "$ref": "#/components/responses/getOrganizations"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations/sso": {
      "get": {
        "tags": [
          "Organizations"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "description": "Request a user token to authenticate the organization. A valid JWT token must be provided in the authorization header.\nInsert the token obtained from this call in your other calls in the https header in the form of authorization: Bearer {token}.<br><br>\nOnly partners can make this call.\n",
        "summary": "Retrieve organization token",
        "operationId": "getOrganizationSso",
        "responses": {
          "200": {
            "$ref": "#/components/responses/getOrganizationSso"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations/{orgId}": {
      "get": {
        "tags": [
          "Organizations"
        ],
        "description": "Retrieve the details of an organization.",
        "summary": "Retrieve organization details",
        "operationId": "getOrganization",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getOrganization"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "patch": {
        "tags": [
          "Organizations"
        ],
        "description": "Update an organization and its properties.<br><br> The default general purge time is 31 days. To increase purge times above this amount, speak to your partner success manager (PSM).<br><br>Note: PATCH calls update data partially. Any data not mentioned in the call, will be kept as is.",
        "summary": "Update organization",
        "operationId": "patchOrganization",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/patchOrganization"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/patchOrganization"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "delete": {
        "tags": [
          "Organizations"
        ],
        "description": "Delete an organization which has no devices assigned to it.",
        "summary": "Delete organization",
        "operationId": "deleteOrganization",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/deleteOrganization"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations/{orgId}/default-settings": {
      "get": {
        "tags": [
          "Organizations"
        ],
        "description": "Retrieve the default settings of an organization, including the device settings, event settings, and webhook destination URLs.",
        "summary": "Retrieve organization default settings",
        "operationId": "getOrganizationDefaultSettings",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getOrganizationDefaultSettingsResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations/{orgId}/default-settings/pin-codes": {
      "post": {
        "tags": [
          "Organizations"
        ],
        "description": "Retrieve the default pin code settings of an organization.",
        "summary": "Retrieve the organization default PIN code settings",
        "operationId": "getOrganizationDefaultPinCodeSettings",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/getDevicePinCodes"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/getOrganizationDefaultPinCodeSettingsResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations/{orgId}/device-settings": {
      "post": {
        "tags": [
          "Organizations"
        ],
        "description": "Update the default device settings for all devices in an organization. <b>When the Organization profile is enabled,</b> these settings apply to all devices currently in the organization and to any devices added in the future. <br><b>Note:</b> This API call facilitates partial updates of resource configurations. Settings explicitly included in the requested payload are modified to their new values, while omitted settings retain their current values.",
        "summary": "Update default device settings",
        "operationId": "postOrganizationDeviceSettings",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postDeviceConfigOrg"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postDeviceSettingsOrganization"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations/{orgId}/event-settings": {
      "post": {
        "tags": [
          "Organizations"
        ],
        "description": "Update the default event settings for all devices in an organization.<b>When the Organization profile is enabled,</b> these settings apply to all devices currently in the organization and any devices added in the future.<br><b>Note:</b> This API call only updates the existing event settings object with the values provided in the requested payload. If no values are provided, the existing settings are deleted.",
        "summary": "Update default event settings",
        "operationId": "postOrganizationEventSettings",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postEventConfigOrg"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postEventSettingsOrganization"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "patch": {
        "tags": [
          "Organizations"
        ],
        "description": "Update the default event settings for all devices in an organization. These settings apply to all devices currently in the organization and any devices added in the future.<br><b>Note:</b> <br>1. This API call only updates the existing event settings object with the values provided in the requested payload. Any values not provided in the request will remain the same.</br>2. If an organization profile is enabled, the updated values will be set for all devices in this organization. Any values not provided, will not be updated in the devices' settings.",
        "summary": "Update the default event settings",
        "operationId": "patchOrganizationEventSettings",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/patchEventConfigOrg"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/patchEventOrganization"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations/{orgId}/privacy-config": {
      "patch": {
        "tags": [
          "Organizations"
        ],
        "description": "This call is currently in BETA. Contact your Technical Account Manager for more information.<br><br> Update default privacy mode configurations for all devices in an organization. These settings apply to all devices currently in the organization and any devices added in the future.<br><b>Note:</b> <br>1. This API call only updates the privacy mode configuration object with the values provided in the requested payload. Any values not provided in the request will remain the same.</br>2. If an organization profile is enabled, the updated values will be set for all devices in this organization. Any values not provided, will not be updated in the privacy mode' settings.",
        "summary": "Update default privacy mode configurations (BETA)",
        "operationId": "patchOrganizationPrivacyConfig",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/patchOrgPrivacyConfig"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/patchOrgPrivacyConfig"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "get": {
        "tags": [
          "Organizations"
        ],
        "description": "This call is currently in BETA. Contact your Technical Account Manager for more information.<br><br> Retrieve default privacy mode configurations for all devices in an organization.",
        "summary": "Retrieve default privacy mode configurations (BETA)",
        "operationId": "getOrganizationPrivacyConfig",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/patchOrgPrivacyConfig"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations/{orgId}/webhook-settings": {
      "post": {
        "tags": [
          "Organizations"
        ],
        "description": "Update all webhook settings for all devices in an organization. These settings apply to all devices currently in the organization and any devices added in the future. <br><br>Note: This call updates all webhook settings in the call. Any webhook setting not configured in the call, is deleted.",
        "summary": "Update device webhooks settings",
        "operationId": "postOrganizationWebhookSettings",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postWebhookConfigOrg"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postOrganizationWebhookSettings"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "patch": {
        "tags": [
          "Organizations"
        ],
        "description": "Update specified webhook settings for all devices in an organization. These settings apply to all devices currently in the organization and any devices added in the future. <br><br>Note: This call updates only webhook settings configured in the call. Any webhook settings not configured in the call, remain as they are.",
        "summary": "Update device webhooks settings",
        "operationId": "patchOrganizationWebhookSettings",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postWebhookConfigOrg"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postOrganizationWebhookSettings"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations/{orgId}/events": {
      "post": {
        "tags": [
          "Organizations"
        ],
        "description": "Retrieve the complete list of events for an organization; the retention period for events is thirty days. <br>If multiple events are generated with the same timestamp, to the second, and the same media type, the media file from the last request is used for all of them. To have different media files for each virtual event, use timestamps that differ by at least a second. <br>The maximum period between start and end must be less(or equal) than 31 days.",
        "summary": "Retrieve organization events",
        "operationId": "getOrganizationsEvents",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          },
          {
            "$ref": "#/components/parameters/startQuery"
          },
          {
            "$ref": "#/components/parameters/endQuery"
          },
          {
            "$ref": "#/components/parameters/limitQueryDefault200"
          },
          {
            "$ref": "#/components/parameters/offsetQueryMin0"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postRetrieveOrganizationEvents"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDeviceEvents"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations/{orgId}/devices-data-usage": {
      "get": {
        "tags": [
          "Organizations"
        ],
        "description": "Retrieve the data usage of all devices in an organization, as well as any webhook destination URLs.",
        "summary": "Retrieve organization devices data usage",
        "operationId": "getOrganizationDevicesDataUsage",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          },
          {
            "$ref": "#/components/parameters/offsetQuery"
          },
          {
            "$ref": "#/components/parameters/limitQueryDefault100Max200"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getOrganizationDevicesDataUsage"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations/{orgId}/devices/data-profile/{dataProfileId}": {
      "put": {
        "tags": [
          "Organizations"
        ],
        "description": "Set data profile to all devices in the organization. For more information, see [Data profile options](https://developer.surfsight.net/developer-portal/data-profiles/).",
        "summary": "Set data profile to all devices in the organization",
        "operationId": "putOrganizationDevicesDataProfile",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          },
          {
            "$ref": "#/components/parameters/dataProfileIdPath"
          },
          {
            "$ref": "#/components/parameters/limitQueryDefault100Max200"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/putOrganizationDevicesDataProfile"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/defaultSuccessResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations/{orgId}/data-profile": {
      "put": {
        "tags": [
          "Organizations"
        ],
        "description": "Set the default data profile for all devices in an organization. <b>When the Organization profile is enabled,</b> this data profile is applied to all devices currently in the organization and to any devices added in the future. Only partners can make this call. For more information, see [Data profile options](https://developer.surfsight.net/developer-portal/data-profiles/).'",
        "summary": "Set an organization's default data profile",
        "operationId": "putOrganizationDevicesDefaultDataProfile",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/putOrgDefaultDataProfileRequestObject"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/defaultSuccessResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "get": {
        "tags": [
          "Organizations"
        ],
        "description": "Retrieve the default data profile for all devices in an organization. Only partners can make this call.",
        "summary": "Retrieve an organization's default data profile",
        "operationId": "getOrganizationDevicesDefaultDataProfile",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getOrganizationDefaultDataProfileResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations/{orgId}/devices/billing-status": {
      "get": {
        "tags": [
          "Organizations"
        ],
        "description": "Retrieve the billing status of all devices in an organization. Only partners can make this call.",
        "summary": "Retrieve organization devices billing status",
        "operationId": "getOrganizationDevicesBillingStatus",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          },
          {
            "$ref": "#/components/parameters/offsetQuery"
          },
          {
            "$ref": "#/components/parameters/limitQuery"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getOrganizationDevicesBillingStatus"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/drivers": {
      "get": {
        "tags": [
          "Drivers"
        ],
        "description": "Retrieve a list of all the drivers in an organization.",
        "summary": "Retrieve list of drivers",
        "operationId": "getDrivers",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/organizationIdQuery"
          },
          {
            "$ref": "#/components/parameters/driverFirstNameQuery"
          },
          {
            "$ref": "#/components/parameters/driverLastNameQuery"
          },
          {
            "$ref": "#/components/parameters/driverIdQuery"
          },
          {
            "$ref": "#/components/parameters/driverThirdPartyIdQuery"
          },
          {
            "$ref": "#/components/parameters/driverIsActiveQuery"
          },
          {
            "$ref": "#/components/parameters/driversSortQuery"
          },
          {
            "$ref": "#/components/parameters/orderQuery"
          },
          {
            "$ref": "#/components/parameters/offsetQuery"
          },
          {
            "$ref": "#/components/parameters/limitQuery"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDrivers"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "post": {
        "tags": [
          "Drivers"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "description": "Add one or more drivers to an organization.<br><br>Note: POST calls create new data, and do not affect existing data.",
        "summary": "Create drivers",
        "operationId": "postDrivers",
        "parameters": [
          {
            "$ref": "#/components/parameters/organizationRequiredOnlyForPartnersQuery"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postDrivers"
        },
        "responses": {
          "201": {
            "$ref": "#/components/responses/defaultSuccessResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "409": {
            "$ref": "#/components/responses/conflictError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "patch": {
        "tags": [
          "Drivers"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "description": "Update one or more drivers within an organization.<br><br>Note: PATCH calls update data partially. Any data not mentioned in the call, will be kept as is.",
        "summary": "Update drivers",
        "operationId": "patchDrivers",
        "parameters": [
          {
            "$ref": "#/components/parameters/organizationIdQuery"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/patchDrivers"
        },
        "responses": {
          "204": {
            "$ref": "#/components/responses/defaultSuccessResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "409": {
            "$ref": "#/components/responses/conflictError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "put": {
        "tags": [
          "Drivers"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "description": "Activate or deactivate one or more drivers within an organization.<br><br>Note: PUT calls update data entirely. Any data not mentioned in the call, will be deleted.",
        "summary": "Change the active state of the driver",
        "operationId": "putDrivers",
        "parameters": [
          {
            "$ref": "#/components/parameters/organizationIdQuery"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/putDrivers"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/putDriversResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "409": {
            "$ref": "#/components/responses/conflictError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "delete": {
        "tags": [
          "Drivers"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "description": "Delete one or more inactive drivers from an organization.",
        "summary": "Delete drivers",
        "operationId": "deleteDrivers",
        "parameters": [
          {
            "$ref": "#/components/parameters/organizationIdQuery"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/deleteDrivers"
        },
        "responses": {
          "204": {
            "$ref": "#/components/responses/defaultSuccessResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/drivers/devices": {
      "post": {
        "tags": [
          "Drivers"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "description": "Assign one or more drivers to a device (one-to-one). One driver can be assigned to one device. Each device can have only one driver assigned at once. <br><br>Note: POST calls create new data, and do not affect existing data.",
        "summary": "Assign drivers to devices",
        "operationId": "associationDriversToDevices",
        "requestBody": {
          "$ref": "#/components/requestBodies/assignDriversToDevices"
        },
        "responses": {
          "201": {
            "$ref": "#/components/responses/defaultSuccessResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "409": {
            "$ref": "#/components/responses/conflictError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "delete": {
        "tags": [
          "Drivers"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "description": "Remove drivers from their assigned device.",
        "summary": "Remove drivers from devices",
        "operationId": "removeDriversFromDevices",
        "requestBody": {
          "$ref": "#/components/requestBodies/removeDriversFromDevices"
        },
        "responses": {
          "204": {
            "$ref": "#/components/responses/defaultSuccessResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/driving-history": {
      "get": {
        "tags": [
          "Drivers"
        ],
        "description": "Retrieve the driving history of a specific device, driver from a specific time range.",
        "summary": "Retrieve driving history",
        "operationId": "getDrivingHistory",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/driverThirdPartyIdQuery"
          },
          {
            "$ref": "#/components/parameters/organizationRequiredOnlyForPartnersQuery"
          },
          {
            "$ref": "#/components/parameters/imeiQuery"
          },
          {
            "$ref": "#/components/parameters/startOptionalQuery"
          },
          {
            "$ref": "#/components/parameters/endOptionalQuery"
          },
          {
            "$ref": "#/components/parameters/drivingHistorySortQuery"
          },
          {
            "$ref": "#/components/parameters/orderQuery"
          },
          {
            "$ref": "#/components/parameters/offsetQuery"
          },
          {
            "$ref": "#/components/parameters/limitQuery"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/drivingHistoryResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/drivers/{driverId}/qr-code": {
      "get": {
        "tags": [
          "Drivers"
        ],
        "description": "Get the driver QR code using the inline image. This API will be implemented for driver check-in with the future v3.12 firmware upgrade.",
        "summary": "Retrieve the driver's unique QR code as an inline base64 encoded .png image",
        "operationId": "getDriverQRcode",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/organizationRequiredOnlyForPartnersQuery"
          },
          {
            "$ref": "#/components/parameters/driverIdPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDriverQRcodeResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations/{orgId}/users": {
      "get": {
        "tags": [
          "Users"
        ],
        "description": "Receive a list of all the users in an organization.",
        "summary": "Receive: list of organization users",
        "operationId": "getOrganizationUsers",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getOrganizationUsers"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "post": {
        "tags": [
          "Users"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "description": "Create a user within an organization.<br><br>Note: POST calls create new data, and do not affect existing data.",
        "summary": "Create user",
        "operationId": "postOrganizationUsers",
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postOrganizationUsers"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postOrganizationUsers"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations/{orgId}/external-users": {
      "x-swagger-router-controller": "Users",
      "get": {
        "tags": [
          "Users"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "operationId": "getOrganizationExternalUsers",
        "description": "Retrieve a list of all the external users in a specific organization.",
        "summary": "Retrieve list of external users",
        "responses": {
          "200": {
            "$ref": "#/components/responses/getOrganizationExternalUsers"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "post": {
        "tags": [
          "Users"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "operationId": "postOrganizationExternalUser",
        "description": "Assign a user who already exists in the Surfsight database to an additional organization as an external user. The user needs administrator permissions in their original organization and receives administrator permissions in the organization to which they are now assigned. <br><br>Note: POST calls create new data, and do not affect existing data.",
        "summary": "Add external user",
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postOrganizationExternalUser"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postOrganizationExternalUser"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "delete": {
        "tags": [
          "Users"
        ],
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "operationId": "deleteOrganizationExternalUser",
        "description": "Delete an external user from an organization. The user still exists with administrator permissions in their original organization.",
        "summary": "Delete external user",
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/deleteOrganizationExternalUser"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/deleteOrganizationExternalUser"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/partner-devices": {
      "get": {
        "tags": [
          "Partners"
        ],
        "description": "Retrieve a list of all partner devices",
        "summary": "Retrieve partner devices",
        "operationId": "getPartnerDevices",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/limitQuery"
          },
          {
            "$ref": "#/components/parameters/offsetQueryMin0"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getPartnerDevices"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/partners/{partnerId}/contacts/{partnerContactId}": {
      "delete": {
        "tags": [
          "Partners"
        ],
        "description": "Delete a partner contact.",
        "summary": "Delete partner contact",
        "operationId": "deletePartnerContacts",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/partnerIdPath"
          },
          {
            "$ref": "#/components/parameters/partnerContactIdPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/deletePartnerContacts"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "patch": {
        "tags": [
          "Partners"
        ],
        "description": "Edit the partner contact.<br><br>Note: PATCH calls update data partially. Any data not mentioned in the call, will be kept as is.",
        "summary": "Edit partner contact",
        "operationId": "patchPartnerContacts",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/partnerIdPath"
          },
          {
            "$ref": "#/components/parameters/partnerContactIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/patchPartnerContacts"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/patchPartnerContacts"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/partners/{partnerId}/contacts": {
      "post": {
        "tags": [
          "Partners"
        ],
        "description": "Create a new partner contact  (up to 250 contacts allowed per partner). <br><br>Note: POST calls create new data, and do not affect existing data.",
        "summary": "Create partner contact",
        "operationId": "postPartnerContacts",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/partnerIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postPartnerContacts"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postPartnerContacts"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "get": {
        "tags": [
          "Partners"
        ],
        "description": "Retrieve a list of partner contacts",
        "summary": "Retrieve partner contacts",
        "operationId": "getPartnerContacts",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/partnerIdPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getPartnerContacts"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/partner-contacts": {
      "get": {
        "tags": [
          "Partners"
        ],
        "description": "Retrieve a list of partner contacts, along with the partner's own details.",
        "summary": "Retrieve partner and contacts",
        "operationId": "getCurrentPartnerContacts",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getCurrentPartnerContacts"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/me": {
      "get": {
        "tags": [
          "Partners",
          "Users"
        ],
        "description": "Retrieve the current authenticated entity's information.",
        "summary": "Retrieve personal information",
        "operationId": "getMe",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getMe"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/cameras/{cameraId}/snapshot": {
      "get": {
        "tags": [
          "Recordings"
        ],
        "description": "Retrieve a snapshot from the in-cab or road-facing lens, or from any paired auxiliary camera. The snapshot captures a picture of the specified current lens for the specified device. The camera must be online.",
        "summary": "Retrieve camera snapshot",
        "operationId": "getDeviceCameraSnapshot",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          },
          {
            "$ref": "#/components/parameters/cameraIdPath"
          },
          {
            "$ref": "#/components/parameters/cameraIdsQuery"
          },
          {
            "$ref": "#/components/parameters/timeQuery"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDeviceCameraSnapshot"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "417": {
            "$ref": "#/components/responses/expectationFailedError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/recording-ranges": {
      "get": {
        "tags": [
          "Recordings"
        ],
        "description": "Retrieve a list of available recordings from every camera of a device in a given time range.",
        "summary": "Retrieve recordings availability",
        "operationId": "getDeviceRecordingRanges",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          },
          {
            "$ref": "#/components/parameters/startQuery"
          },
          {
            "$ref": "#/components/parameters/endQuery"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDeviceRecordingRanges"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "423": {
            "$ref": "#/components/responses/LockedError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/retention-config": {
      "get": {
        "tags": [
          "Recordings"
        ],
        "description": "Retrieve the cyclic recording retention time, in minutes, for each camera of a device. The cyclic retention time is the amount of time that recordings are kept on the SD card before the first recording is removed to make space for a new recording.",
        "summary": "Retrieve recording retention time",
        "operationId": "getDeviceRetentionConfig",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDeviceRetentionConfig"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "put": {
        "tags": [
          "Recordings"
        ],
        "description": "Update the cyclic recording retention time, in minutes, for each camera of a device. The cyclic retention time is the amount of time that recordings are kept on the SD card before the first recording is removed to make space for a new recording.<br><br> Reset the device to update the camera retention times in the cloud. <br><br>Note: PUT calls update data entirely. Any data not mentioned in the call, will be deleted.",
        "summary": "Update recording retention time",
        "operationId": "putDeviceRetentionConfig",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/putDeviceRetentionConfig"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/putDeviceRetentionConfig"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/virtual-event": {
      "post": {
        "tags": [
          "Virtual Event"
        ],
        "description": "Generate a virtual event. Optionally, media (a video or an image) may be uploaded to the cloud, or no media. <br><br>**Important:** For best results, when uploading media always use the *quality* and *durationSeconds* parameters.<br><br> To receive media from all lenses, leave out the *cameraId* parameter.<br> If multiple events are generated with the same timestamp, to the second, and the same media type, the media file from the last request is used for all of them. To have different media files for each virtual event, use timestamps that differ by at least a second. <br><br>Note: POST calls create new data, and do not affect existing data.",
        "summary": "Generate virtual event",
        "operationId": "postVirtualEvent",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postVirtualEvent"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postVirtualEvent"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "417": {
            "$ref": "#/components/responses/expectationFailedError"
          },
          "423": {
            "$ref": "#/components/responses/LockedError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/event-config": {
      "put": {
        "tags": [
          "Events"
        ],
        "description": "Set the events settings in bulk for devices. Provide either a list of IMEIs or group IDs. <br><br>Note: PUT calls update data entirely. Any data not mentioned in the call, will be deleted.",
        "summary": "Bulk configure events settings",
        "operationId": "putBulkEventConfig",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/putBulkEventConfig"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/putBulkEventConfig"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/events/{eventId}": {
      "delete": {
        "tags": [
          "Events"
        ],
        "description": "Delete an event.",
        "summary": "Delete event",
        "operationId": "deleteDeviceEvent",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          },
          {
            "$ref": "#/components/parameters/eventIdPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/deleteDeviceEvent"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "get": {
        "tags": [
          "Events"
        ],
        "description": "Retrieve an event.<br>If multiple events are generated with the same timestamp, to the second, and the same media type, the media file from the last request is used for all of them. To have different media files for each virtual event, use timestamps that differ by at least a second.",
        "summary": "Retrieve event",
        "operationId": "getDeviceEvent",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          },
          {
            "$ref": "#/components/parameters/eventIdPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDeviceEvent"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/event-file-link": {
      "get": {
        "tags": [
          "Events"
        ],
        "description": "Retrieve the link to an event file generated by the device. The URL remains active for approximately several minutes to a few hours. If this call is made shortly after the event, the event media may not be uploaded yet and a 404 error is returned. In this case, try again a few minutes later.<br> If multiple events are generated with the same timestamp, to the second, and the same media type, the media file from the last request is used for all of them. To have different media files for each virtual event, use timestamps that differ by at least a second. <br><br>This API can be used in two ways:<br><br> 1. For events in a given period of time. The files can then be downloaded. All the information required for this call is available in the event object received from the GET /devices/{imei}/events call<br><br> 2. For virtual events, without using the GET /devices/{imei}/events call. You need additional information, such as the virtual event configuration on your device and the IDs of the cameras connected to the device<br><br> Note: For video events, you may retrieve either a video or a snapshot. The snapshot will be taken from the middle of the event video.<br> <ul> <li>To retrieve a concealed snapshot, the conceal service must be enabled, and either a regular snapshot, or a concealed video, must already be ready.</li><br> <li>The snapshot will be taken from the middle of the event video.</li><br> <li>If a video is not ready yet, requesting a snapshot should return this error message: \"Snapshot cannot be retrieved as the event video is not ready yet. Please try again in two minutes.\"</li><br> <li>If a concealed snapshot is requested, fetch it only if a concealed video, or a regular snapshot, is already available on S3. Otherwise, you will receive an informative error message: \"Failed to retrieve a concealed snapshot. If Concealment is enabled, request a snapshot or a concealed video first.\"</li><br> <li>Any snapshot events will still return a 404 error when requested with <b>fileType=video</b>.</li><br> <li>This will work for all video events.</li> </ul>",
        "summary": "Retrieve file link",
        "operationId": "getDeviceEventFileLink",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          },
          {
            "$ref": "#/components/parameters/fileIdQuery"
          },
          {
            "$ref": "#/components/parameters/fileTypeQuery"
          },
          {
            "$ref": "#/components/parameters/cameraIdQuery"
          },
          {
            "$ref": "#/components/parameters/cameraIdsQuery"
          },
          {
            "$ref": "#/components/parameters/concealQuery"
          },
          {
            "$ref": "#/components/parameters/eventIdQuery"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDeviceEventFileLink"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "429": {
            "$ref": "#/components/responses/tooManyRequestsError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/event-file-links": {
      "get": {
        "tags": [
          "Events"
        ],
        "description": "Retrieve the links to event files generated by the device. The URLs remain active for approximately several minutes to a few hours. If this call is made shortly after the event, the event media may not be uploaded yet and a 404 error is returned. In this case, try again a few minutes later.<br> If multiple events are generated with the same timestamp, to the second, and the same media type, the media file from the last request is used for all of them. To have different media files for each virtual event, use timestamps that differ by at least a second. <br><br>This API can be used in two ways:<br><br> 1. For events in a given period of time. The files can then be downloaded. All the information required for this call is available in the event object received from the GET /devices/{imei}/events call<br><br> 2. For virtual events, without using the GET /devices/{imei}/events call. You need additional information, such as the virtual event configuration on your device and the IDs of the cameras connected to the device<br><br> Note: For video events, you may retrieve either a video or a snapshot. The snapshot will be taken from the middle of the event video.<br> <ul> <li>To retrieve a concealed snapshot, the conceal service must be enabled, and either a regular snapshot, or a concealed video, must already be ready.</li><br> <li>The snapshot will be taken from the middle of the event video.</li><br> <li>If a video is not ready yet, requesting a snapshot should return this error message: \"Snapshot cannot be retrieved as the event video is not ready yet. Please try again in two minutes.\"</li><br> <li>If a concealed snapshot is requested, fetch it only if a concealed video, or a regular snapshot, is already available on S3. Otherwise, you will receive an informative error message: \"Failed to retrieve a concealed snapshot. If Concealment is enabled, request a snapshot or a concealed video first.\"</li><br> <li>Any snapshot events will still return a 404 error when requested with <b>fileType=video</b>.</li><br> <li>This will work for all video events.</li> </ul>",
        "summary": "Retreive a list of file links",
        "operationId": "getDeviceEventManyFileLinks",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          },
          {
            "$ref": "#/components/parameters/fileIdQuery"
          },
          {
            "$ref": "#/components/parameters/fileTypeQuery"
          },
          {
            "$ref": "#/components/parameters/cameraIdsQuery"
          },
          {
            "$ref": "#/components/parameters/concealQuery"
          },
          {
            "$ref": "#/components/parameters/eventIdQuery"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDeviceEventManyFileLinks"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "429": {
            "$ref": "#/components/responses/tooManyRequestsError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/events": {
      "get": {
        "tags": [
          "Events"
        ],
        "description": "Retrieve a list of a device's events in a given time range. The retention period for events is thirty days. <br>If multiple events are generated with the same timestamp, to the second, and the same media type, the media file from the last request is used for all of them. To have different media files for each virtual event, use timestamps that differ by at least a second. <br>The maximum period between start and end must be less(or equal) than 31 days.",
        "summary": "Retrieve list of events",
        "operationId": "getDeviceEvents",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          },
          {
            "$ref": "#/components/parameters/startQuery"
          },
          {
            "$ref": "#/components/parameters/endQuery"
          },
          {
            "$ref": "#/components/parameters/eventStatusQuery"
          },
          {
            "$ref": "#/components/parameters/limitQueryMax200"
          },
          {
            "$ref": "#/components/parameters/offsetQueryMin0"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDeviceEvents"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/event-review-state": {
      "patch": {
        "tags": [
          "Events"
        ],
        "description": "Update an event status and severity and add comments to the event.<br><br>Note: PATCH calls update data partially. Any data not mentioned in the call, will be kept as is.",
        "summary": "Update event review",
        "operationId": "patchDeviceEventReviewState",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/patchDeviceEventReviewState"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/patchDeviceEventReviewState"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/event-config": {
      "get": {
        "tags": [
          "Events"
        ],
        "description": "Retrieve the events settings of a device.",
        "summary": "Retrieve events settings",
        "operationId": "getEventConfig",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getEventConfig"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "put": {
        "tags": [
          "Events"
        ],
        "description": "Set the events settings for a device.<br><br>Note: PUT calls update data entirely. Any data not mentioned in the call, will be deleted.",
        "summary": "Set events settings",
        "operationId": "putEventConfig",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/putEventConfig"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/putEventConfig"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/geofences": {
      "put": {
        "tags": [
          "Geofences"
        ],
        "description": "Set a geofence for a device. Up to 99 geofences can be set for one device.<br><br>Note: PUT calls update data entirely. Any data not mentioned in the call, will be deleted.",
        "summary": "Set geofence",
        "operationId": "setDeviceGeoFences",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/setDeviceGeoFences"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/setDeviceGeoFences"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "get": {
        "tags": [
          "Geofences"
        ],
        "description": "Retrieve a list of all the configured geofences of a device.",
        "summary": "Retrieve list of geofences",
        "operationId": "getDeviceGeoFences",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDeviceGeoFences"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/connect-media": {
      "post": {
        "tags": [
          "Streaming"
        ],
        "description": "Receive the URL to retrieve a recording or live video and the authentication token\nrequired for the URL. The token is valid for thirty minutes. Make this call again if your device does not start streaming within two minutes.\n",
        "summary": "Prepare media streaming",
        "operationId": "postDeviceConnectMedia",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/postDeviceConnectMedia"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "423": {
            "$ref": "#/components/responses/LockedError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/{cameraId}/telemetry": {
      "get": {
        "tags": [
          "Telemetry"
        ],
        "description": "Retrieve the telemetry data from the specified lens of the device or from the auxiliary cameras.",
        "summary": "Retrieve camera telemetry data",
        "operationId": "getDeviceCameraTelemetry",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          },
          {
            "$ref": "#/components/parameters/cameraIdPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDeviceCameraTelemetry"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "417": {
            "$ref": "#/components/responses/expectationFailedError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/telemetry": {
      "get": {
        "tags": [
          "Telemetry"
        ],
        "description": "Retrieve the telemetry data of a device. The device must be online.\n",
        "summary": "Retrieve device telemetry data",
        "operationId": "getDeviceTelemetry",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDeviceTelemetry"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "417": {
            "$ref": "#/components/responses/expectationFailedError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/auxiliary-cameras/search": {
      "get": {
        "tags": [
          "Device Operations"
        ],
        "description": "Request the device to search for available auxiliary cameras around the device.\nA system message webhook will be sent once the search on the device is completed.\n",
        "summary": "Search device auxiliary cameras",
        "operationId": "searchDeviceAuxiliaryCameras",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          },
          {
            "$ref": "#/components/parameters/auxiliaryCamerasSearchlimitQuery"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/defaultSuccessResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "423": {
            "$ref": "#/components/responses/LockedError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/auxiliary-cameras/pair": {
      "post": {
        "tags": [
          "Device Operations"
        ],
        "description": "Request the device to pair provided auxiliary cameras.\nA system message webhook will be sent after the camera is paired with the device.\n",
        "summary": "Pair device auxiliary cameras",
        "operationId": "pairDeviceAuxiliaryCameras",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/pairDeviceAuxiliaryCameras"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/defaultSuccessResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "423": {
            "$ref": "#/components/responses/LockedError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/auxiliary-cameras/unpair": {
      "post": {
        "tags": [
          "Device Operations"
        ],
        "description": "Initiate the unpairing process for the provided auxiliary cameras.\nA system message webhook will be sent after the camera is unpaired from the device.\n",
        "summary": "Unpair device auxiliary cameras",
        "operationId": "unpairDeviceAuxiliaryCameras",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/unpairDeviceAuxiliaryCameras"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/defaultSuccessResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "423": {
            "$ref": "#/components/responses/LockedError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/auxiliary-cameras/billing": {
      "post": {
        "tags": [
          "Device Operations"
        ],
        "description": "Enable or disable auxiliary camera billing for the provided devices or organization.\n",
        "summary": "Enable or disable auxiliary camera billing",
        "operationId": "postDeviceAuxiliaryCamerasBilling",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postDeviceAuxiliaryCamerasBilling"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postDeviceAuxiliaryCamerasBilling"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "423": {
            "$ref": "#/components/responses/LockedError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/auxiliary-cameras/billing-status": {
      "post": {
        "tags": [
          "Device Operations"
        ],
        "description": "Retrieve the billing status of the provided devices or organization.\n",
        "summary": "Retrieve billing status",
        "operationId": "getDeviceAuxiliaryCamerasBillingStatus",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/getDeviceAuxiliaryCamerasBillingStatus"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDeviceAuxiliaryCamerasBillingStatus"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "423": {
            "$ref": "#/components/responses/LockedError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/bulk/privacy-config": {
      "patch": {
        "tags": [
          "Devices"
        ],
        "description": "This call is currently in BETA. Contact your Technical Account Manager for more information.<br><br>\nPrivacy mode configuration API.\n",
        "summary": "Set bulk devices privacy mode configuration (BETA)",
        "operationId": "bulkPatchPrivacyConfig",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/patchPrivacyConfigV2"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/defaultMultiResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/privacy-config": {
      "get": {
        "tags": [
          "Devices"
        ],
        "description": "This call is currently in BETA. Contact your Technical Account Manager for more information.<br><br>\nRetrieve device privacy mode configurations.\n",
        "summary": "Retrieve device privacy mode configurations (BETA)",
        "operationId": "getPrivacyConfig",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getPrivacyConfigV2Response"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/gps": {
      "get": {
        "tags": [
          "Telemetry"
        ],
        "description": "Retrieve the GPS data of a device in a given time range.",
        "summary": "Retrieve GPS data",
        "operationId": "getDeviceGps",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          },
          {
            "$ref": "#/components/parameters/startQuery"
          },
          {
            "$ref": "#/components/parameters/endQuery"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDeviceGps"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/trips": {
      "get": {
        "tags": [
          "Telemetry"
        ],
        "description": "Retrieve a list of trips for a device in a given time range. The retention period of trips data is thirty days",
        "summary": "Retrieve list of trips",
        "operationId": "getDeviceTrips",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          },
          {
            "$ref": "#/components/parameters/startQuery"
          },
          {
            "$ref": "#/components/parameters/endQuery"
          },
          {
            "$ref": "#/components/parameters/minimumTripDistanceQuery"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDeviceTrips"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/score": {
      "get": {
        "tags": [
          "Devices"
        ],
        "description": "Retrieve the safety score of a device. The safety score calculates how many events have occurred in a certain time range while taking into account the total distance traveled during that time. The lower the number, the better the score.",
        "summary": "Retrieve device safety score",
        "operationId": "getDeviceScore",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          },
          {
            "$ref": "#/components/parameters/startQuery"
          },
          {
            "$ref": "#/components/parameters/endQuery"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDeviceScore"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/notification-recipients/{email}": {
      "delete": {
        "tags": [
          "Events"
        ],
        "description": "Remove a notification recipient for a specific event triggered from a device.",
        "summary": "Delete event notification recipient",
        "operationId": "deleteDeviceNotificationRecipient",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          },
          {
            "$ref": "#/components/parameters/emailPath"
          },
          {
            "$ref": "#/components/parameters/eventTypeQuery"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/deleteDeviceNotificationRecipient"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations/{orgId}/groups/{groupId}/devices": {
      "post": {
        "tags": [
          "Groups"
        ],
        "description": "Add devices to a group. Only devices that belong to the associated organization can be added to a group. If the device belongs to a different group, it is removed from that group and added to the new group.",
        "summary": "Add devices to group",
        "operationId": "postOrganizationGroupDevices",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          },
          {
            "$ref": "#/components/parameters/groupIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postOrganizationGroupDevices"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postOrganizationGroupDevices"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations/{orgId}/groups": {
      "put": {
        "tags": [
          "Groups"
        ],
        "description": "Update an existing group in an organization.<br><br>Note: PUT calls update data entirely. Any data not mentioned in the call, will be deleted.",
        "summary": "Update group",
        "operationId": "updateOrganizationGroups",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/updateOrganizationGroup"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postOrganizationGroups"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "delete": {
        "tags": [
          "Groups"
        ],
        "description": "Delete an existing group in an organization.",
        "summary": "Delete group",
        "operationId": "deleteOrganizationGroups",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/deleteOrganizationGroup"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postOrganizationGroups"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "post": {
        "tags": [
          "Groups"
        ],
        "description": "Create a new group in an organization.<br><br>Note: POST calls create new data, and do not affect existing data.",
        "summary": "Create group",
        "operationId": "postOrganizationGroups",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postOrganizationGroups"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postOrganizationGroups"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "get": {
        "tags": [
          "Groups"
        ],
        "description": "Retrieve a list of all the groups in an organization.",
        "summary": "Retrieve list of organization groups",
        "operationId": "getOrganizationGroups",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getOrganizationGroups"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/audit-logs": {
      "get": {
        "tags": [
          "Audit logs"
        ],
        "description": "Retrieve the audit logs of an organization.<br><br> If large amounts of data are being retrieved, your call could time out after 30 seconds. To prevent this from occurring, we recommend using pagination in the query parameters.<br><br> When using a partner token:<br> <ul> <li>Retrieve all records relevant for a specific IMEI with these parameters:<br> entityPartnerId + entityType=device + entityId=SPECIFIC_IMEI</li><br> <li>Retrieve records relevant for all the partner’s devices with these parameters:<br> entityPartnerId + entityType=device</li><br> <li>Retrieve records relevant for all your organization’s devices with these parameters:<br> entityOrganizationId + entityType=device</li> </ul>",
        "summary": "Retrieve organization audit logs",
        "operationId": "getAuditLogs",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/limitQuery"
          },
          {
            "$ref": "#/components/parameters/offsetQueryMin0"
          },
          {
            "$ref": "#/components/parameters/startQuery"
          },
          {
            "$ref": "#/components/parameters/endQuery"
          },
          {
            "$ref": "#/components/parameters/userIdQuery"
          },
          {
            "$ref": "#/components/parameters/partnerIdQuery"
          },
          {
            "$ref": "#/components/parameters/userTypeQuery"
          },
          {
            "$ref": "#/components/parameters/organizationIdQuery"
          },
          {
            "$ref": "#/components/parameters/imeiQuery"
          },
          {
            "$ref": "#/components/parameters/entityQuery"
          },
          {
            "$ref": "#/components/parameters/entityTypeQuery"
          },
          {
            "$ref": "#/components/parameters/entityOrgIdQuery"
          },
          {
            "$ref": "#/components/parameters/entityPartnerIdQuery"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getAuditLogs"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations/{orgId}/webhooks/{webhookId}": {
      "delete": {
        "tags": [
          "Webhooks"
        ],
        "description": "Delete a webhook from an organization.",
        "summary": "Delete webhook",
        "operationId": "deleteOrganizationWebhooks",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          },
          {
            "$ref": "#/components/parameters/webhookIdPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/deleteOrganizationWebhooks"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations/{orgId}/webhooks": {
      "post": {
        "tags": [
          "Webhooks"
        ],
        "description": "Add a device to the webhook subscription.<br><b>Note:</b> If a webhook with the same URL already exists, this API call  updates its configuration. If a webhook with the same URL does not exist, this call creates a new webhook entry.",
        "summary": "Add device to webhook subscription",
        "operationId": "postOrganizationWebhook",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postOrganizationWebhook"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postOrganizationWebhook"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "put": {
        "tags": [
          "Webhooks"
        ],
        "description": "Replace the entire list of devices subscribed to webhooks with a new list of devices. <br><br>Note: PUT calls update data entirely. Any data not mentioned in the call, will be deleted.\n",
        "summary": "Replace webhooks subscription devices",
        "operationId": "putOrganizationWebhooks",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/putOrganizationWebhooks"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/putOrganizationWebhooks"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "get": {
        "tags": [
          "Webhooks"
        ],
        "description": "Retrieve a list of the webhooks configured for an organization.",
        "summary": "Retrieve organization webhooks",
        "operationId": "getOrganizationWebhooks",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          },
          {
            "$ref": "#/components/parameters/imeiQuery"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getOrganizationWebhooks"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organizations/{orgId}/get-recording-encryption-keys": {
      "post": {
        "tags": [
          "Organizations"
        ],
        "description": "Retrieve the latest recording encryption keys for some, or all, devices in an organization.",
        "summary": "Retrieve organization or IMEIs’ latest recording encryption keys",
        "operationId": "postOrganizationGetLatestRecordingEncryptionKeys",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postOrganizationGetLatestRecordingEncryptionKeys"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postOrganizationGetLatestRecordingEncryptionKeysResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/recipients/health/{recipientId}": {
      "delete": {
        "tags": [
          "Health"
        ],
        "description": "Delete an email address to which health reports are sent.",
        "summary": "Delete health report email recipient",
        "operationId": "deleteHealthRecipient",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/recipientIdPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/deleteHealthRecipient"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/recipients/health": {
      "post": {
        "tags": [
          "Health"
        ],
        "description": "Add an email address to which health reports are sent. Emails are sent at a set interval. <br><br>Note: POST calls create new data, and do not affect existing data.",
        "summary": "Add health report email recipient",
        "operationId": "postHealthRecipient",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/partnerOrganizationIdQuery"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postHealthRecipient"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postHealthRecipient"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "get": {
        "tags": [
          "Health"
        ],
        "description": "Retrieve a list of the email addresses to which health reports are sent. Partners can receive a list of email addresses for a specific organization by providing the organization ID.",
        "summary": "Retrieve list of health report email recipients",
        "operationId": "getHealthRecipients",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/partnerOrganizationIdQuery"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getHealthRecipients"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/device-health": {
      "get": {
        "tags": [
          "Health"
        ],
        "description": "Retrieve the health reports of your devices. Partners can receive the health reports of a specific organization by providing the organization ID.",
        "summary": "Retrieve health reports",
        "operationId": "getDevicesHealth",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/limitQuery"
          },
          {
            "$ref": "#/components/parameters/offsetQuery"
          },
          {
            "$ref": "#/components/parameters/lastConnectedAtStartQuery"
          },
          {
            "$ref": "#/components/parameters/lastConnectedAtEndQuery"
          },
          {
            "$ref": "#/components/parameters/lastRecordingUpdatedAtStartQuery"
          },
          {
            "$ref": "#/components/parameters/lastRecordingUpdatedAtEndQuery"
          },
          {
            "$ref": "#/components/parameters/lastRecordingHealthQuery"
          },
          {
            "$ref": "#/components/parameters/partnerOrganizationIdQuery"
          },
          {
            "$ref": "#/components/parameters/imeiQuery"
          },
          {
            "$ref": "#/components/parameters/nameQuery"
          },
          {
            "$ref": "#/components/parameters/deviceHealthSortQuery"
          },
          {
            "$ref": "#/components/parameters/orderQuery"
          },
          {
            "$ref": "#/components/parameters/billingStatusQuery"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDevicesHealth"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/device-data-usage": {
      "get": {
        "tags": [
          "Health"
        ],
        "description": "Retrieve the data usage reports of your devices. Partners can receive the device data usage reports of a specific organization by providing the organization ID.",
        "summary": "Retrieve device data usage reports",
        "operationId": "getDeviceDataUsageReport",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/organizationIdQuery"
          },
          {
            "$ref": "#/components/parameters/limitQuery"
          },
          {
            "$ref": "#/components/parameters/offsetQueryMin0"
          },
          {
            "$ref": "#/components/parameters/imeiQuery"
          },
          {
            "$ref": "#/components/parameters/nameQuery"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getDevicesDataUsageReport"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/alarms/{alarmId}/actions": {
      "post": {
        "tags": [
          "Alarms"
        ],
        "description": "Add an action to an alarm. Actions include: \"read\", \"unread\", \"close\", \"open\". <br><br>Note: POST calls create new data, and do not affect existing data.",
        "summary": "Add action",
        "operationId": "postAlarmAction",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/alarmIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postAlarmAction"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postAlarmAction"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/alarms/{alarmId}/comments": {
      "post": {
        "tags": [
          "Alarms"
        ],
        "description": "Add a comment to an alarm. <br><br>Note: POST calls create new data, and do not affect existing data.",
        "summary": "Add comment",
        "operationId": "postAlarmComment",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/alarmIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postAlarmComment"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postAlarmComment"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/recipients/alarms/{recipientId}": {
      "patch": {
        "tags": [
          "Alarms"
        ],
        "description": "Update the settings of the alarms report email recipient.<br><b>Note:</b> PATCH calls update data partially. Any data not mentioned in the call, will be kept as is. However, in this call, if only reportIntervalSeconds is provided in the request body, it returns a 400 Bad Request error. Other combinations of parameters in the request body function as expected.",
        "summary": "Update email recipient settings",
        "operationId": "patchAlarmsRecipient",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/recipientIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/patchAlarmsRecipient"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/patchAlarmsRecipient"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "delete": {
        "tags": [
          "Alarms"
        ],
        "description": "Delete an email address to which the alarms report is sent.",
        "summary": "Delete email recipient",
        "operationId": "deleteAlarmsRecipient",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/recipientIdPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/deleteAlarmsRecipient"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/recipients/alarms": {
      "post": {
        "tags": [
          "Alarms"
        ],
        "description": "Add an email address to which alarms reports are sent. Emails are sent at a set interval. Partners can add alarms recipient specific to an organization by providing the organization ID. <br><br>Note: POST calls create new data, and do not affect existing data.",
        "summary": "Add email recipient",
        "operationId": "postAlarmsRecipient",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/partnerOrganizationIdQuery"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postAlarmsRecipient"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/postAlarmsRecipient"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "get": {
        "tags": [
          "Alarms"
        ],
        "description": "Retrieve a list of email addresses to which alarms reports are sent. Partners can receive a list of email addresses from a specific organization by providing the organization ID.",
        "summary": "Retrieve alarms report email recipients",
        "operationId": "getAlarmsRecipients",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/partnerOrganizationIdQuery"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getAlarmsRecipients"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/alarms": {
      "get": {
        "tags": [
          "Alarms"
        ],
        "description": "Retrieve a list of the alarms from your devices. Partners can receive a list of alarms from a specific organization by providing the organization ID. Alarms are saved in the cloud for 45 days.",
        "summary": "Retrieve alarms report",
        "operationId": "getAlarms",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/limitQuery"
          },
          {
            "$ref": "#/components/parameters/offsetQuery"
          },
          {
            "$ref": "#/components/parameters/partnerOrganizationIdQuery"
          },
          {
            "$ref": "#/components/parameters/imeiQuery"
          },
          {
            "$ref": "#/components/parameters/nameQuery"
          },
          {
            "$ref": "#/components/parameters/alarmDefinitionNameQuery"
          },
          {
            "$ref": "#/components/parameters/alarmDefinitionSeverityQuery"
          },
          {
            "$ref": "#/components/parameters/readFilterQuery"
          },
          {
            "$ref": "#/components/parameters/unreadFilterQuery"
          },
          {
            "$ref": "#/components/parameters/openFilterQuery"
          },
          {
            "$ref": "#/components/parameters/closeFilterQuery"
          },
          {
            "$ref": "#/components/parameters/alarmsSortQuery"
          },
          {
            "$ref": "#/components/parameters/orderQuery"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getAlarms"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/alarms/{alarmId}": {
      "get": {
        "tags": [
          "Alarms"
        ],
        "description": "Retrieve the details of an alarm.",
        "summary": "Retrieve alarm details",
        "operationId": "getAlarm",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/alarmIdPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getAlarm"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/alarm-simulator": {
      "post": {
        "tags": [
          "Alarms"
        ],
        "description": "Add simulated alarm. Users may perform all operations on this alarm, as if it was a regular system generated alarm. <br><br>Note: POST calls create new data, and do not affect existing data.",
        "summary": "Add simulated alarm",
        "operationId": "postSimulatedAlarm",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/simulatedAlarm"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/simulatedAlarmResponse"
          },
          "304": {
            "$ref": "#/components/responses/notModifiedError"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/partners/operational-statistics": {
      "get": {
        "tags": [
          "Partner Operation Statistics"
        ],
        "description": "Retrieve the operational statistics of a partner’s devices and organizations. Only partners can make this call.",
        "summary": "Retrieve partner operational statistics",
        "operationId": "getPartnerOperationalStatistics",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/previousMonthsQuery"
          },
          {
            "$ref": "#/components/parameters/previousWeeksQuery"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getPartnerOperationalStatistics"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/white-label-information/{whiteLabelDomainAddress}": {
      "get": {
        "tags": [
          "Partners"
        ],
        "description": "Retrieve the details of your white label portal, such as any images used in the portal and the portal's domain address.",
        "summary": "Retrieve white label details",
        "operationId": "getWhiteLabelInformation",
        "parameters": [
          {
            "$ref": "#/components/parameters/domainAddressPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/whiteLabelInformation"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/notification-recipients": {
      "get": {
        "tags": [
          "Events"
        ],
        "description": "Get device recipients",
        "summary": "Retrieve a list of recipients that receive email notification for a triggered event.",
        "operationId": "getDeviceRecipients",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          },
          {
            "$ref": "#/components/parameters/eventTypeQuery"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/defaultRecipientNotificationSuccessResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/{imei}/events/{eventType}/notification-recipients": {
      "put": {
        "tags": [
          "Events"
        ],
        "description": "Update the events notification recipients.<br><br>Note: PUT calls update data entirely. Any data not mentioned in the call, will be deleted.",
        "summary": "Update events notification recipients",
        "operationId": "putEventNotificationRecipients",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/imeiPath"
          },
          {
            "$ref": "#/components/parameters/eventType"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/putEventsNotificationRecipient"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/defaultSuccessResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/devices/events/{eventType}/notification-recipients": {
      "put": {
        "tags": [
          "Events"
        ],
        "description": "Update recipients for email notifications of an event in bulk. <br><br>\nOnly recipients included in this call receive email notificaitons. A recipient who was previously receiving notifications but was not included in this call is removed from the list of recipients receiving notifications. <br><br>Note: PUT calls update data entirely. Any data not mentioned in the call, will be deleted.",
        "summary": "Update event notification recipients in bulk",
        "operationId": "putBulkEventNotificationRecipients",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/eventType"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/putBulkEventNotificationRecipients"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/defaultSuccessResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organization-album/{orgId}/album/config": {
      "post": {
        "tags": [
          "Organization Album"
        ],
        "description": "This call is currently in a restricted BETA status. Contact your Technical Account Manager for more information.<br><br> Enable or disable the album for an organization.<br><br> Note: If the album is enabled for the organization, this call updates the album's configuration and starts building the album. <br> If the album is disabled, this call deletes the album and all of its data. Disabling the album call is irreversible - all images will be deleted. <br><br> The following profiles have permission to make this call: <ul> <li>partners</li> <li>sub-partners</li> <li>administrators</li> <li>supervisors</li> </ul> ",
        "summary": "Enable or disable the album (BETA)",
        "operationId": "postOrganizationAlbumConfig",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postOrganizationAlbumConfig"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/defaultSuccessResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      },
      "get": {
        "tags": [
          "Organization Album"
        ],
        "description": "This call is currently in a restricted BETA status. Contact your Technical Account Manager for more information.<br><br> Retrieve the album status for an organization. <br><br> The following profiles have permission to make this call: <ul> <li>partners</li> <li>sub-partners</li> <li>administrators</li> <li>supervisors</li> </ul> ",
        "summary": "Retrieve album status (BETA)",
        "operationId": "getOrganizationAlbumConfig",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getOrganizationAlbumConfig"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organization-album/{orgId}/album": {
      "get": {
        "tags": [
          "Organization Album"
        ],
        "description": "This call is currently in a restricted BETA status. Contact your Technical Account Manager for more information.<br><br> Retrieve all album images for an organization based on the specified filters. <br><br> The following profiles have permission to make this call: <ul> <li>partners</li> <li>sub-partners</li> <li>administrators</li> <li>supervisors</li> </ul> ",
        "summary": "Retrieve album images (BETA)",
        "operationId": "getOrganizationAlbumImages",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          },
          {
            "$ref": "#/components/parameters/statusOuery"
          },
          {
            "$ref": "#/components/parameters/imeiAlbumQuery"
          },
          {
            "$ref": "#/components/parameters/startTimeOuery"
          },
          {
            "$ref": "#/components/parameters/endTimeOuery"
          },
          {
            "$ref": "#/components/parameters/limitQueryMax2000"
          },
          {
            "$ref": "#/components/parameters/offsetQueryMin0"
          }
        ],
        "responses": {
          "200": {
            "$ref": "#/components/responses/getOrganizationAlbumImages"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    },
    "/organization-album/{orgId}/album/status": {
      "post": {
        "tags": [
          "Organization Album"
        ],
        "description": "This call is currently in a restricted BETA status. Contact your Technical Account Manager for more information.<br><br> Set the status of a image (familiar, unfamiliar). <br><br> Most images in the driver verification workflow can transition between states. Images categorized as Familiar or Unfamiliar are blocked from entering the Pending Review.<br> Note: The pendingReview status is an internal default and cannot be updated manually. <br><br> The following profiles have permission to make this call: <ul> <li>partners</li> <li>sub-partners</li> <li>administrators</li> <li>supervisors</li> </ul> ",
        "summary": "Set an image status (BETA)",
        "operationId": "postOrganizationAlbumImageStatus",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/orgIdPath"
          }
        ],
        "requestBody": {
          "$ref": "#/components/requestBodies/postOrganizationAlbum"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/defaultSuccessResponse"
          },
          "400": {
            "$ref": "#/components/responses/badRequestError"
          },
          "401": {
            "$ref": "#/components/responses/unauthorizedError"
          },
          "403": {
            "$ref": "#/components/responses/forbiddenError"
          },
          "404": {
            "$ref": "#/components/responses/notFoundError"
          },
          "409": {
            "$ref": "#/components/responses/conflictError"
          },
          "500": {
            "$ref": "#/components/responses/internalServerError"
          }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer"
      }
    },
    "requestBodies": {
      "createOAuthClient": {
        "description": "Request body for creating a new OAuth client",
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "clientName": {
                  "$ref": "#/components/schemas/oAuthClientName"
                }
              }
            }
          }
        }
      },
      "updateOAuthClientStatus": {
        "description": "Request body for updating OAuth client status",
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "enabled"
              ],
              "properties": {
                "enabled": {
                  "$ref": "#/components/schemas/oAuthClientEnabled"
                }
              }
            }
          }
        }
      },
      "generateAccessToken": {
        "description": "Request body for generating an OAuth access token using client credentials",
        "required": true,
        "content": {
          "application/x-www-form-urlencoded": {
            "schema": {
              "type": "object",
              "required": [
                "grantType",
                "clientId",
                "clientSecret"
              ],
              "properties": {
                "grantType": {
                  "type": "string",
                  "description": "OAuth 2.0 grant type (must be \"client_credentials\")",
                  "enum": [
                    "client_credentials"
                  ],
                  "example": "client_credentials"
                },
                "clientId": {
                  "$ref": "#/components/schemas/oAuthClientId"
                },
                "clientSecret": {
                  "$ref": "#/components/schemas/oAuthClientSecret"
                },
                "scope": {
                  "type": "string",
                  "description": "Optional space-separated list of scopes",
                  "example": "all"
                }
              }
            }
          }
        }
      },
      "introspectToken": {
        "description": "Request body for OAuth token introspection",
        "required": true,
        "content": {
          "application/x-www-form-urlencoded": {
            "schema": {
              "type": "object",
              "required": [
                "token",
                "clientId",
                "clientSecret"
              ],
              "properties": {
                "token": {
                  "type": "string",
                  "description": "The access token to introspect"
                },
                "clientId": {
                  "$ref": "#/components/schemas/oAuthClientId"
                },
                "clientSecret": {
                  "$ref": "#/components/schemas/oAuthClientSecret"
                }
              }
            }
          }
        }
      },
      "getDevicePinCodes": {
        "description": "Retrieve the PIN codes of a given device",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "password"
              ],
              "properties": {
                "password": {
                  "type": "string",
                  "description": "The password of the current user."
                }
              }
            }
          }
        }
      },
      "postOrganizationGetLatestRecordingEncryptionKeys": {
        "required": false,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "imeis": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/imei"
                  }
                }
              }
            }
          }
        }
      },
      "postRetrieveOrganizationEvents": {
        "required": false,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "eventTypes": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/eventType"
                  }
                }
              }
            }
          }
        }
      },
      "putDeviceRetentionConfig": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "config"
              ],
              "properties": {
                "config": {
                  "$ref": "#/components/schemas/retentionConfig"
                }
              }
            }
          }
        }
      },
      "assignDriversToDevices": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/driverDeviceAssignment"
                  }
                }
              }
            }
          }
        }
      },
      "removeDriversFromDevices": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "driverThirdPartyId": {
                        "$ref": "#/components/schemas/driverThirdPartyIdInRequestBody"
                      },
                      "imei": {
                        "$ref": "#/components/schemas/imei"
                      },
                      "organizationId": {
                        "$ref": "#/components/schemas/organizationIdRequiredForPartner"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "postDrivers": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/postDriver"
                  }
                }
              }
            }
          }
        }
      },
      "patchDrivers": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/patchDriver"
                  }
                }
              }
            }
          }
        }
      },
      "putDrivers": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/putDriver"
                  }
                }
              }
            }
          }
        }
      },
      "deleteDrivers": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/deleteDriver"
                  }
                }
              }
            }
          }
        }
      },
      "patchDevice": {
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "name"
              ],
              "properties": {
                "name": {
                  "$ref": "#/components/schemas/deviceName"
                }
              }
            }
          }
        }
      },
      "postAuthenticate": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "email",
                "password"
              ],
              "properties": {
                "email": {
                  "$ref": "#/components/schemas/email"
                },
                "password": {
                  "$ref": "#/components/schemas/password"
                }
              }
            }
          }
        }
      },
      "postResetPassword": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "newPassword"
              ],
              "properties": {
                "newPassword": {
                  "$ref": "#/components/schemas/password"
                }
              }
            }
          }
        }
      },
      "postChangePassword": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "currentPassword",
                "newPassword"
              ],
              "properties": {
                "currentPassword": {
                  "$ref": "#/components/schemas/password"
                },
                "newPassword": {
                  "$ref": "#/components/schemas/password"
                }
              }
            }
          }
        }
      },
      "putUserSettings": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "measurement",
                "timeFormat"
              ],
              "properties": {
                "measurement": {
                  "type": "number",
                  "description": "The measurement units used in the cloud.<br><br> type 1 - us/imperial, type 2 - metric",
                  "enum": [
                    1,
                    2
                  ]
                },
                "timeFormat": {
                  "type": "number",
                  "description": "The time format used in the cloud.<br><br> type 1 - 24 hours, type 2 - am/pm",
                  "enum": [
                    1,
                    2
                  ]
                }
              }
            }
          }
        }
      },
      "postOrganizationUsers": {
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "email",
                "password",
                "role"
              ],
              "properties": {
                "email": {
                  "$ref": "#/components/schemas/email"
                },
                "password": {
                  "$ref": "#/components/schemas/password"
                },
                "role": {
                  "$ref": "#/components/schemas/role"
                },
                "groupIds": {
                  "description": "The IDs of the requested groups.",
                  "type": "array",
                  "uniqueItems": true,
                  "items": {
                    "$ref": "#/components/schemas/groupId"
                  }
                }
              }
            }
          }
        }
      },
      "postOrganizationExternalUser": {
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "email"
              ],
              "properties": {
                "email": {
                  "$ref": "#/components/schemas/email"
                }
              }
            }
          }
        }
      },
      "deleteOrganizationExternalUser": {
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "email"
              ],
              "properties": {
                "email": {
                  "$ref": "#/components/schemas/email"
                }
              }
            }
          }
        }
      },
      "postOrganizationDevicesCalibrateAccelerometer": {
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "imeis": {
                  "type": "array",
                  "description": "The IMEI numbers of the devices you want to calibrate. The IMEI number can be found on a sticker on the device itself or on the back of the device box.",
                  "items": {
                    "$ref": "#/components/schemas/imei"
                  }
                },
                "groups": {
                  "type": "array",
                  "description": "The group IDs of the device groups you want to calibrate. Obtain group IDs from GET /organizations/{orgId}/devices.",
                  "items": {
                    "$ref": "#/components/schemas/groupId"
                  }
                },
                "ungrouped": {
                  "type": "boolean",
                  "description": "Calibrate any devices that do not belong to a group. Find out which devices do not belong to a group from GET /organizations/{orgId}/devices,"
                }
              }
            }
          }
        }
      },
      "patchUserOrganizationPermissions": {
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "role",
                "organizationAccessEdgeGroupIds"
              ],
              "properties": {
                "role": {
                  "$ref": "#/components/schemas/role"
                },
                "organizationAccessEdgeGroupIds": {
                  "type": "array",
                  "description": "The IDs of the groups to which the user should receive access.",
                  "items": {
                    "oneOf": [
                      {
                        "$ref": "#/components/schemas/groupId"
                      },
                      {
                        "type": "integer",
                        "minimum": -2,
                        "maximum": -2,
                        "title": "All groups",
                        "description": "Access to all groups.",
                        "example": -2
                      }
                    ]
                  }
                }
              }
            }
          }
        }
      },
      "postBulkDevices": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "array",
              "items": {
                "type": "object",
                "required": [
                  "imei",
                  "name"
                ],
                "properties": {
                  "imei": {
                    "$ref": "#/components/schemas/imei"
                  },
                  "name": {
                    "$ref": "#/components/schemas/deviceName"
                  },
                  "groupId": {
                    "$ref": "#/components/schemas/groupId"
                  }
                }
              }
            }
          }
        }
      },
      "postDeviceWifiPassword": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "imeis": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/imei"
                  },
                  "uniqueItems": true,
                  "minItems": 1,
                  "maxItems": 100
                }
              }
            }
          }
        }
      },
      "postVirtualEvent": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "time"
              ],
              "properties": {
                "time": {
                  "description": "Event date and time, in ISO 8601 format.",
                  "$ref": "#/components/schemas/time"
                },
                "mediaType": {
                  "description": "The type of media uploaded.",
                  "type": "string",
                  "default": "video",
                  "enum": [
                    "none",
                    "video",
                    "snapshot"
                  ]
                },
                "durationSeconds": {
                  "description": "The length of the video, in seconds. Half of the video is from before the event is triggered, and half is from after. The duration of the video may differ from the time requested, depending on the availability of the recordings. Only applies to the video mediaType. For video, include this parameter for best results.",
                  "type": "number",
                  "default": 10,
                  "minimum": 1,
                  "maximum": 86400
                },
                "quality": {
                  "description": "The quality of the video. This parameter is optional but should be included for best results. <br> If set to 'standard', the resulting recording will be 1 frame per second. <br> If set to 'high', the resulting recording will inherit its framerate from the data profile. <br> If this parameter is not set, the resulting recording will default to 1 frame per second.",
                  "type": "string",
                  "default": "standard",
                  "enum": [
                    "standard",
                    "high"
                  ]
                },
                "cameraId": {
                  "description": "The ID of the in-cab or road-facing lens, or any paired auxiliary camera. Include this parameter for best results. <br><br> 1 - road-facing lens, 2 - in-cab lens, 50+ - auxiliary cameras.",
                  "type": "integer",
                  "example": 1,
                  "oneOf": [
                    {
                      "description": "1 - road-facing lens, 2 - in-cab lens.",
                      "enum": [
                        1,
                        2
                      ]
                    },
                    {
                      "description": "50+ - auxiliary cameras.",
                      "minimum": 50
                    }
                  ]
                },
                "metadata": {
                  "description": "The metadata of the event.",
                  "type": "string"
                },
                "visualAlert": {
                  "description": "Whether a visual alert is shown on the device screen when an event occurs.",
                  "type": "boolean"
                },
                "audioAlert": {
                  "description": "Whether an audio alert is played when an event occurs.",
                  "type": "boolean"
                }
              }
            }
          }
        }
      },
      "putBulkEventConfig": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "oneOf": [
                {
                  "$ref": "#/components/schemas/putBulkEventConfigImeis"
                },
                {
                  "$ref": "#/components/schemas/putBulkEventConfigGroups"
                }
              ]
            }
          }
        }
      },
      "putEventConfig": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/eventConfig"
            }
          }
        }
      },
      "putDeviceConfig": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/deviceConfig"
            }
          }
        }
      },
      "putCalibrateAdas": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "oneOf": [
                {
                  "$ref": "#/components/schemas/adasCalibrationData"
                },
                {
                  "$ref": "#/components/schemas/reducedAdasCalibrationData"
                }
              ]
            }
          }
        }
      },
      "postCalibrateAdas": {
        "required": false,
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/autoAdasCalibrationData"
            }
          }
        }
      },
      "putBulkDeviceConfig": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "oneOf": [
                {
                  "$ref": "#/components/schemas/putBulkDeviceConfigOrganization"
                },
                {
                  "$ref": "#/components/schemas/putBulkDeviceConfigImeis"
                }
              ]
            }
          }
        }
      },
      "postDeviceConfigOrg": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/deviceConfig"
            }
          }
        }
      },
      "postEventConfigOrg": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/eventConfig"
            }
          }
        }
      },
      "patchEventConfigOrg": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/patchEventConfig"
            }
          }
        }
      },
      "postWebhookConfigOrg": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/webhookConfig"
            }
          }
        }
      },
      "setDeviceGeoFences": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "array",
              "description": "The geofence event configurations array.",
              "maxItems": 99,
              "items": {
                "$ref": "#/components/schemas/geofence"
              }
            }
          }
        }
      },
      "postAssociatedDevices": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "imeis": {
                  "type": "array",
                  "description": "The IMEI numbers. The IMEI number can be found on a sticker on the device itself or on the back of the device box.",
                  "items": {
                    "$ref": "#/components/schemas/imei"
                  }
                }
              }
            }
          }
        }
      },
      "getDevicesDataUsage": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "imeis": {
                  "type": "array",
                  "description": "The IMEI numbers. The IMEI number can be found on a sticker on the device itself or on the back of the device box.",
                  "items": {
                    "$ref": "#/components/schemas/imei",
                    "uniqueItems": true,
                    "minItems": 1,
                    "maxItems": 100
                  }
                }
              }
            }
          }
        }
      },
      "RecalibrationRequest": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "imeis": {
                  "type": "array",
                  "description": "Please provide the device imeis for which you want to perform auto recalibration.",
                  "items": {
                    "uniqueItems": true,
                    "minItems": 1,
                    "maxItems": 100,
                    "example": "357660101000198"
                  }
                }
              }
            }
          }
        }
      },
      "postPartnerContacts": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "allOf": [
                {
                  "$ref": "#/components/schemas/partnerContact"
                },
                {
                  "type": "object",
                  "required": [
                    "password"
                  ],
                  "properties": {
                    "password": {
                      "$ref": "#/components/schemas/password"
                    },
                    "accessLevel": {
                      "$ref": "#/components/schemas/accessLevel"
                    }
                  }
                }
              ]
            }
          }
        }
      },
      "patchPartnerContacts": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "allOf": [
                {
                  "type": "object",
                  "required": [
                    "id"
                  ],
                  "properties": {
                    "id": {
                      "type": "number",
                      "description": "The ID of the entity.",
                      "example": 99999
                    }
                  }
                },
                {
                  "$ref": "#/components/schemas/partnerContact"
                },
                {
                  "type": "object",
                  "properties": {
                    "accessLevel": {
                      "$ref": "#/components/schemas/accessLevel"
                    }
                  }
                }
              ]
            }
          }
        }
      },
      "postOrganizationDevices": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/device"
            }
          }
        }
      },
      "updateOrganizationGroup": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/groupToUpdate"
            }
          }
        }
      },
      "deleteOrganizationGroup": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/groupToDelete"
            }
          }
        }
      },
      "postOrganizationGroups": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/groupToCreate"
            }
          }
        }
      },
      "postOrganizationGroupDevices": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "array",
              "description": "The IMEI numbers of devices that are added to the group array. If any devices already belong to other groups, they are removed from the original groups.",
              "items": {
                "$ref": "#/components/schemas/imei"
              }
            }
          }
        }
      },
      "postOrganizationWebhook": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "anyOf": [
                {
                  "$ref": "#/components/schemas/webhookTypeGps"
                },
                {
                  "$ref": "#/components/schemas/webhookTypeEvent"
                },
                {
                  "$ref": "#/components/schemas/webhookTypeAlarms"
                },
                {
                  "$ref": "#/components/schemas/webhookTypeSystemMessages"
                }
              ]
            }
          }
        }
      },
      "putOrganizationWebhooks": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "array",
              "description": "The webhooks array.",
              "items": {
                "anyOf": [
                  {
                    "$ref": "#/components/schemas/webhookTypeSystemMessages"
                  },
                  {
                    "$ref": "#/components/schemas/webhookTypeGps"
                  },
                  {
                    "$ref": "#/components/schemas/webhookTypeEvent"
                  },
                  {
                    "$ref": "#/components/schemas/webhookTypeAlarms"
                  }
                ]
              }
            }
          }
        }
      },
      "postOrganization": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "name"
              ],
              "properties": {
                "name": {
                  "type": "string",
                  "description": "The name you assign to the organization.",
                  "example": "Midwest fleet"
                },
                "exclusivePartnerOnly": {
                  "$ref": "#/components/schemas/organizationExclusivePartnerOnly"
                }
              }
            }
          }
        }
      },
      "patchOrganization": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "name": {
                  "$ref": "#/components/schemas/organizationName"
                },
                "exclusivePartnerOnly": {
                  "$ref": "#/components/schemas/organizationExclusivePartnerOnly"
                },
                "purgeDays": {
                  "$ref": "#/components/schemas/organizationPurgeDays"
                },
                "purgeDaysFrontCamera": {
                  "$ref": "#/components/schemas/organizationPurgeDays"
                },
                "purgeDaysRearCamera": {
                  "$ref": "#/components/schemas/organizationPurgeDays"
                },
                "purgeDaysAuxiliaryCameras": {
                  "$ref": "#/components/schemas/organizationPurgeDays"
                },
                "deviceRetentionMinutes": {
                  "$ref": "#/components/schemas/deviceRetentionMinutes"
                },
                "isOrganizationProfileEnabled": {
                  "$ref": "#/components/schemas/isOrganizationProfileEnabledDescriptionForPatch"
                },
                "deIdEnabled": {
                  "$ref": "#/components/schemas/organizationDeIdEnabled"
                },
                "deIdBacklogEnabled": {
                  "$ref": "#/components/schemas/organizationDeIdBacklogEnabled"
                },
                "deIdEnableStrictBlurring": {
                  "$ref": "#/components/schemas/organizationDeIdEnableStrictBlurring"
                },
                "liveVideoTimeoutSeconds": {
                  "type": "number",
                  "description": "The duration, in seconds, that live video plays before ending automatically.",
                  "example": 30,
                  "minimum": 30
                }
              }
            }
          }
        }
      },
      "patchDeviceCameras": {
        "description": "A list of objects containing auxiliary camera IDs and names.",
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "array",
              "description": "The auxiliary cameras array.",
              "uniqueItems": true,
              "minItems": 1,
              "maxItems": 10,
              "items": {
                "type": "object",
                "required": [
                  "cameraId",
                  "name"
                ],
                "properties": {
                  "cameraId": {
                    "$ref": "#/components/schemas/cameraId"
                  },
                  "name": {
                    "type": "string",
                    "description": "The name you assign to the auxiliary camera.",
                    "example": "back of truck",
                    "minimum": 1,
                    "maximum": 191,
                    "nullable": true
                  }
                }
              }
            }
          }
        }
      },
      "postHealthRecipient": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/healthRecipient"
            }
          }
        }
      },
      "postAlarmAction": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/alarmAction"
            }
          }
        }
      },
      "postAlarmComment": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/alarmComment"
            }
          }
        }
      },
      "postAlarmsRecipient": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/alarmsRecipient"
            }
          }
        }
      },
      "patchAlarmsRecipient": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "description": "Update alarms report email recipients object.",
              "properties": {
                "reportIntervalSeconds": {
                  "$ref": "#/components/schemas/alarmsReportIntervalSeconds"
                },
                "alarmDefinitions": {
                  "type": "array",
                  "description": "The alarm definitions array.",
                  "items": {
                    "type": "object",
                    "required": [
                      "id"
                    ],
                    "properties": {
                      "id": {
                        "type": "number",
                        "description": "Array of IDs of alarms that you would like to receive email notifications for.",
                        "example": 625
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "simulatedAlarm": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "description": "The simulated alarm object.",
              "required": [
                "alarmDefinitionId",
                "createdAt"
              ],
              "properties": {
                "alarmDefinitionId": {
                  "$ref": "#/components/schemas/alarmDefinitionCode"
                },
                "createdAt": {
                  "description": "The time stamp for the simulated alarm to be created, in ISO format.",
                  "type": "string",
                  "format": "date-time"
                },
                "metadata": {
                  "description": "The metadata for the simulated alarm, to include additional information such as explanation. The metadata is automatically added as a comment to the new alarm.",
                  "type": "string"
                }
              }
            }
          }
        }
      },
      "putEventsNotificationRecipient": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "notificationRecipients": {
                  "type": "array",
                  "description": "Array of recipients emails",
                  "items": {
                    "$ref": "#/components/schemas/email"
                  }
                }
              }
            }
          }
        }
      },
      "putBulkEventNotificationRecipients": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "oneOf": [
                {
                  "$ref": "#/components/schemas/putBulkEventNotificationRecipientsOrganization"
                },
                {
                  "$ref": "#/components/schemas/putBulkEventNotificationRecipientsImeis"
                }
              ]
            }
          }
        }
      },
      "patchDeviceEventReviewState": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "eventIds",
                "eventReviewState"
              ],
              "properties": {
                "eventIds": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/eventId"
                  }
                },
                "eventReviewState": {
                  "properties": {
                    "status": {
                      "$ref": "#/components/schemas/eventStatus"
                    },
                    "severity": {
                      "$ref": "#/components/schemas/eventSeverity"
                    },
                    "comment": {
                      "$ref": "#/components/schemas/eventCommentText"
                    }
                  }
                }
              }
            }
          }
        }
      },
      "putDeviceDataProfile": {
        "required": false,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "nullable": true
            }
          }
        }
      },
      "putOrganizationDevicesDataProfile": {
        "required": false,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "nullable": true
            }
          }
        }
      },
      "putOrgDefaultDataProfileRequestObject": {
        "required": false,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "defaultDataProfileId"
              ],
              "properties": {
                "defaultDataProfileId": {
                  "type": "number",
                  "title": "Device data profile ID",
                  "description": "The ID of the data profile",
                  "example": 123
                }
              }
            }
          }
        }
      },
      "putDeviceBillingStatus": {
        "required": false,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "nullable": true
            }
          }
        }
      },
      "putBulkDevicesDataProfile": {
        "required": false,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "imeis"
              ],
              "properties": {
                "imeis": {
                  "type": "array",
                  "description": "The IMEI numbers of the devices you want to assign the data profile. The IMEI number can be found on a sticker on the device itself or on the back of the device box.",
                  "minItems": 1,
                  "items": {
                    "$ref": "#/components/schemas/imei"
                  }
                }
              }
            }
          }
        }
      },
      "putBulkDevicesBillingStatus": {
        "required": false,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "imeis"
              ],
              "properties": {
                "imeis": {
                  "type": "array",
                  "description": "The IMEI numbers of the devices you want to assign the billing status. The IMEI number can be found on a sticker on the device itself or on the back of the device box.",
                  "minItems": 1,
                  "items": {
                    "$ref": "#/components/schemas/imei"
                  }
                }
              }
            }
          }
        }
      },
      "pairDeviceAuxiliaryCameras": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "auxiliaryCameras"
              ],
              "properties": {
                "auxiliaryCameras": {
                  "type": "array",
                  "description": "The array of auxiliary cameras that will be paired",
                  "minItems": 1,
                  "maxItems": 8,
                  "items": {
                    "type": "object",
                    "required": [
                      "ssid"
                    ],
                    "properties": {
                      "ssid": {
                        "type": "string",
                        "description": "SSID of the auxiliary camera"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "unpairDeviceAuxiliaryCameras": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "auxiliaryCameras"
              ],
              "properties": {
                "auxiliaryCameras": {
                  "type": "array",
                  "description": "The array of auxiliary cameras that will be unpaired",
                  "minItems": 1,
                  "maxItems": 8,
                  "items": {
                    "oneOf": [
                      {
                        "type": "object",
                        "title": "Auxiliary camera serial number",
                        "required": [
                          "serialNumber"
                        ],
                        "properties": {
                          "serialNumber": {
                            "type": "string",
                            "description": "The serial number of the auxiliary camera. You can get this serial number from 'device telemetry /devices/{imei}/telemetry call.'"
                          }
                        }
                      },
                      {
                        "type": "object",
                        "title": "Auxiliary camera ID",
                        "required": [
                          "cameraId"
                        ],
                        "properties": {
                          "cameraId": {
                            "type": "number",
                            "description": "The camera ID of the auxiliary camera. You can get this ID from 'device telemetry /devices/{imei}/telemetry call.'"
                          }
                        }
                      }
                    ]
                  }
                }
              }
            }
          }
        }
      },
      "postDeviceAuxiliaryCamerasBilling": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "billingStatus"
              ],
              "properties": {
                "billingStatus": {
                  "type": "string",
                  "enum": [
                    "enable",
                    "disable"
                  ],
                  "description": "The billing status of the auxiliary cameras, can be enable or disable"
                }
              },
              "oneOf": [
                {
                  "required": [
                    "imeis"
                  ],
                  "title": "IMEIS",
                  "properties": {
                    "imeis": {
                      "type": "array",
                      "description": "The array of IMEIs",
                      "minItems": 1,
                      "items": {
                        "$ref": "#/components/schemas/imei",
                        "uniqueItems": true,
                        "minItems": 1,
                        "maxItems": 200
                      }
                    }
                  }
                },
                {
                  "required": [
                    "organizationId"
                  ],
                  "title": "Organization Id",
                  "properties": {
                    "organizationId": {
                      "$ref": "#/components/schemas/organizationId"
                    }
                  }
                }
              ]
            }
          }
        }
      },
      "getDeviceAuxiliaryCamerasBillingStatus": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "oneOf": [
                {
                  "title": "IMEIS",
                  "type": "object",
                  "required": [
                    "imeis"
                  ],
                  "properties": {
                    "imeis": {
                      "type": "array",
                      "description": "The array of IMEIs",
                      "items": {
                        "$ref": "#/components/schemas/imei"
                      },
                      "minItems": 1,
                      "maxItems": 200,
                      "uniqueItems": true
                    }
                  }
                },
                {
                  "title": "Organization Id",
                  "type": "object",
                  "required": [
                    "organizationId"
                  ],
                  "properties": {
                    "organizationId": {
                      "$ref": "#/components/schemas/organizationId"
                    }
                  }
                }
              ]
            }
          }
        }
      },
      "postScopedToken": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "entities"
              ],
              "properties": {
                "entities": {
                  "type": "array",
                  "maxItems": 10,
                  "minItems": 1,
                  "items": {
                    "type": "object",
                    "required": [
                      "entityType",
                      "entityId",
                      "features"
                    ],
                    "properties": {
                      "entityType": {
                        "type": "string",
                        "enum": [
                          "device",
                          "group",
                          "organization"
                        ]
                      },
                      "entityId": {
                        "type": "number",
                        "description": "IMEI/GROUP_ID/ORGANIZATION_ID"
                      },
                      "features": {
                        "type": "array",
                        "minItems": 1,
                        "uniqueItems": true,
                        "items": {
                          "type": "object",
                          "required": [
                            "featureType"
                          ],
                          "properties": {
                            "featureType": {
                              "type": "string",
                              "enum": [
                                "deviceLiveStreaming",
                                "deviceEvent",
                                "deviceRecordingTimeline"
                              ]
                            },
                            "allowMedia": {
                              "type": "boolean",
                              "description": "Indicates if media is allowed for the feature"
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "patchPrivacyConfigV2": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "imeis",
                "privacyConfig"
              ],
              "properties": {
                "imeis": {
                  "type": "array",
                  "description": "The IMEI numbers. The IMEI number can be found on a sticker on the device itself or on the back of the device box.",
                  "items": {
                    "$ref": "#/components/schemas/imei"
                  },
                  "uniqueItems": true,
                  "minItems": 1,
                  "maxItems": 200
                },
                "privacyConfig": {
                  "minProperties": 1,
                  "additionalProperties": false,
                  "$ref": "#/components/schemas/privacyConfigV2"
                }
              }
            }
          }
        }
      },
      "postBulkDevicesPrivacyModeObject": {
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "imeis",
                "privacyMode"
              ],
              "properties": {
                "imeis": {
                  "type": "array",
                  "description": "The IMEI numbers. The IMEI number can be found on a sticker on the device itself or on the back of the device box.",
                  "items": {
                    "$ref": "#/components/schemas/imei"
                  },
                  "uniqueItems": true,
                  "minItems": 1,
                  "maxItems": 200
                },
                "privacyMode": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/privacyMode"
                    },
                    {
                      "description": "The device's privacy mode determines its activation.<br> **general**- Enables the privacy mode.<br> **disabled** - Disables the privacy mode.<br> <br>**Note: The first time this API endpoint is called, the device privacy mode configurations will apply and the device settings privacy object will no longer be in use.**"
                    }
                  ]
                }
              }
            }
          }
        }
      },
      "patchOrgPrivacyConfig": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "minProperties": 1,
              "additionalProperties": false,
              "$ref": "#/components/schemas/privacyConfigV2"
            }
          }
        }
      },
      "postOrganizationAlbumConfig": {
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "albumStatus"
              ],
              "properties": {
                "albumStatus": {
                  "type": "string",
                  "description": "The status of the album assigned to the organization.",
                  "example": "enabled",
                  "enum": [
                    "enabled",
                    "disabled"
                  ]
                }
              }
            }
          }
        }
      },
      "postOrganizationAlbum": {
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "status",
                "imageId"
              ],
              "properties": {
                "status": {
                  "type": "string",
                  "description": "Driver Recognition Status.<br> - Familiar: The driver is recognized and authorized to drive fleet vehicles.<br> - Unfamiliar: The driver is not recognized or is unauthorized to drive fleet vehicles.<br>",
                  "example": "familiar",
                  "enum": [
                    "familiar",
                    "unfamiliar"
                  ]
                },
                "imageId": {
                  "type": "string",
                  "example": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
                  "description": "The imageId can be retrieved from the /organization-album/{orgId}/album endpoint (field: id).<br>It is also available in the metadata of the generated unfamiliarDriver event."
                }
              }
            }
          }
        }
      },
      "postAutoCalibrationConfig": {
        "content": {
          "application/json": {
            "schema": {
              "oneOf": [
                {
                  "type": "object",
                  "title": "Partner Auto-Calibration Config",
                  "required": [
                    "enabled",
                    "entityType",
                    "entityValue"
                  ],
                  "properties": {
                    "enabled": {
                      "type": "boolean",
                      "example": true,
                      "description": "Set to true to enable auto-calibration, or set to false to disable it."
                    },
                    "entityType": {
                      "type": "string",
                      "enum": [
                        "partner"
                      ],
                      "example": "partner"
                    },
                    "entityValue": {
                      "$ref": "#/components/schemas/partnerId"
                    }
                  }
                },
                {
                  "type": "object",
                  "title": "Organization Auto-Calibration Config",
                  "required": [
                    "enabled",
                    "entityType",
                    "entityValue"
                  ],
                  "properties": {
                    "enabled": {
                      "type": "boolean",
                      "example": true,
                      "description": "Set to true to enable auto-calibration, or set to false to disable it."
                    },
                    "entityType": {
                      "type": "string",
                      "enum": [
                        "organization"
                      ],
                      "example": "organization"
                    },
                    "entityValue": {
                      "$ref": "#/components/schemas/organizationId"
                    }
                  }
                },
                {
                  "type": "object",
                  "title": "Device Auto-Calibration Config",
                  "required": [
                    "enabled",
                    "entityType",
                    "entityValue"
                  ],
                  "properties": {
                    "enabled": {
                      "type": "boolean",
                      "example": true,
                      "description": "Set to true to enable auto-calibration, or set to false to disable it."
                    },
                    "entityType": {
                      "type": "string",
                      "enum": [
                        "device"
                      ],
                      "example": "device"
                    },
                    "entityValue": {
                      "$ref": "#/components/schemas/imei"
                    }
                  }
                }
              ]
            }
          }
        }
      }
    },
    "responses": {
      "createOAuthClientResponse": {
        "description": "OAuth client created successfully",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "requestId"
              ],
              "properties": {
                "data": {
                  "type": "object",
                  "required": [
                    "clientId",
                    "clientSecret",
                    "entityType",
                    "entityId"
                  ],
                  "properties": {
                    "clientId": {
                      "$ref": "#/components/schemas/oAuthClientId"
                    },
                    "clientSecret": {
                      "$ref": "#/components/schemas/oAuthClientSecret"
                    },
                    "clientName": {
                      "$ref": "#/components/schemas/oAuthClientName"
                    },
                    "entityType": {
                      "$ref": "#/components/schemas/oAuthEntityType"
                    },
                    "entityId": {
                      "$ref": "#/components/schemas/oAuthEntityId"
                    },
                    "createdAt": {
                      "$ref": "#/components/schemas/oAuthClientCreatedAt"
                    }
                  }
                },
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      },
      "getOAuthClientsResponse": {
        "description": "List of OAuth clients retrieved successfully",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "metadata",
                "requestId"
              ],
              "properties": {
                "data": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/oAuthClientObject"
                  }
                },
                "metadata": {
                  "$ref": "#/components/schemas/oAuthClientMetadata"
                },
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      },
      "getOAuthClientByIdResponse": {
        "description": "OAuth client details retrieved successfully",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "requestId"
              ],
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/oAuthClientObject"
                },
                "metadata": {
                  "$ref": "#/components/schemas/oAuthClientMetadata"
                },
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      },
      "updateOAuthClientStatusResponse": {
        "description": "OAuth client status updated successfully",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "requestId"
              ],
              "properties": {
                "data": {
                  "type": "object",
                  "required": [
                    "clientId",
                    "clientStatus"
                  ],
                  "properties": {
                    "clientId": {
                      "$ref": "#/components/schemas/oAuthClientId"
                    },
                    "clientName": {
                      "$ref": "#/components/schemas/oAuthClientName"
                    },
                    "entityType": {
                      "$ref": "#/components/schemas/oAuthEntityType"
                    },
                    "entityId": {
                      "$ref": "#/components/schemas/oAuthEntityId"
                    },
                    "enabled": {
                      "$ref": "#/components/schemas/oAuthClientEnabled"
                    },
                    "createdAt": {
                      "$ref": "#/components/schemas/oAuthClientCreatedAt"
                    }
                  }
                },
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      },
      "deleteOAuthClientResponse": {
        "description": "OAuth client deleted successfully",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "message",
                "clientId",
                "requestId"
              ],
              "properties": {
                "message": {
                  "type": "string",
                  "description": "Success message",
                  "example": "Client deleted successfully"
                },
                "clientId": {
                  "$ref": "#/components/schemas/oAuthClientId"
                },
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      },
      "rotateClientSecretResponse": {
        "description": "OAuth client secret rotated successfully",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "requestId"
              ],
              "properties": {
                "data": {
                  "type": "object",
                  "required": [
                    "clientId",
                    "clientSecret"
                  ],
                  "properties": {
                    "clientId": {
                      "$ref": "#/components/schemas/oAuthClientId"
                    },
                    "clientSecret": {
                      "$ref": "#/components/schemas/oAuthClientSecret"
                    },
                    "clientName": {
                      "$ref": "#/components/schemas/oAuthClientName"
                    },
                    "entityType": {
                      "$ref": "#/components/schemas/oAuthEntityType"
                    },
                    "entityId": {
                      "$ref": "#/components/schemas/oAuthEntityId"
                    },
                    "createdAt": {
                      "$ref": "#/components/schemas/oAuthClientCreatedAt"
                    }
                  }
                },
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      },
      "generateAccessTokenResponse": {
        "description": "Access token generated successfully",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "accessToken",
                "tokenType",
                "expiresIn"
              ],
              "properties": {
                "accessToken": {
                  "type": "string",
                  "description": "The generated OAuth access token (JWT format)",
                  "example": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                },
                "tokenType": {
                  "type": "string",
                  "description": "The type of token (always Bearer for OAuth 2.0)",
                  "enum": [
                    "Bearer"
                  ],
                  "example": "Bearer"
                },
                "expiresIn": {
                  "type": "integer",
                  "description": "Token expiration time in seconds from issuance",
                  "example": 14400
                },
                "refreshExpiresIn": {
                  "type": "integer",
                  "description": "Refresh token expiration time in seconds (if applicable)",
                  "example": 0
                },
                "notBeforePolicy": {
                  "type": "integer",
                  "description": "Token cannot be used before this time (Unix timestamp)",
                  "example": 0
                },
                "scope": {
                  "type": "string",
                  "description": "Space-separated list of granted scopes",
                  "example": "all"
                },
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      },
      "introspectTokenResponse": {
        "description": "Token introspection details retrieved successfully",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "active"
              ],
              "properties": {
                "exp": {
                  "type": "integer",
                  "description": "Token expiration timestamp (Unix time)"
                },
                "iat": {
                  "type": "integer",
                  "description": "Token issued at timestamp (Unix time)"
                },
                "jti": {
                  "type": "string",
                  "description": "Unique identifier for the token (JWT ID)"
                },
                "iss": {
                  "type": "string",
                  "description": "Issuer of the token (authorization server URL)"
                },
                "sub": {
                  "type": "string",
                  "description": "Subject of the token (unique identifier of the authenticated entity)"
                },
                "typ": {
                  "type": "string",
                  "description": "Type of the token (e.g., Bearer)"
                },
                "azp": {
                  "type": "string",
                  "description": "Authorized party (client ID that requested the token)"
                },
                "accessLevel": {
                  "type": "string",
                  "description": "Access level or role granted to the token (e.g., editor, view)"
                },
                "name": {
                  "type": "string",
                  "description": "Display name associated with the authenticated entity"
                },
                "source": {
                  "type": "string",
                  "description": "Authentication source that issued the token (e.g., oauth)"
                },
                "id": {
                  "type": "integer",
                  "description": "Internal identifier of the authenticated entity"
                },
                "type": {
                  "type": "string",
                  "description": "Type of the authenticated entity (e.g., reseller)"
                },
                "email": {
                  "type": "string",
                  "description": "Email address associated with the authenticated entity"
                },
                "parentResellerId": {
                  "type": "integer",
                  "description": "Internal identifier of the parent reseller associated with the authenticated entity"
                },
                "clientId": {
                  "$ref": "#/components/schemas/oAuthClientId"
                },
                "username": {
                  "type": "string",
                  "description": "Username or service account name associated with the token"
                },
                "tokenType": {
                  "type": "string",
                  "description": "Token type returned by the authorization server (e.g., Bearer)"
                },
                "active": {
                  "type": "boolean",
                  "description": "Indicates whether the token is currently active and valid",
                  "example": true
                },
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      },
      "postOrganizationGetLatestRecordingEncryptionKeysResponse": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "keys"
              ],
              "properties": {
                "keys": {
                  "type": "array",
                  "description": "The array of the latest device recording encryption keys per IMEI",
                  "items": {
                    "type": "object",
                    "properties": {
                      "imei": {
                        "type": "string"
                      },
                      "key": {
                        "type": "string"
                      },
                      "createdAt": {
                        "type": "string"
                      },
                      "confirmedByDevice": {
                        "type": "boolean"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "getDeviceRecordingEncryptionKeysResponse": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "keyHistory",
                "active"
              ],
              "properties": {
                "keyHistory": {
                  "type": "array",
                  "description": "The array of the device recording encryption keys",
                  "items": {
                    "type": "object",
                    "properties": {
                      "key": {
                        "type": "string"
                      },
                      "algorithm": {
                        "type": "string"
                      },
                      "confirmedByDevice": {
                        "type": "boolean"
                      },
                      "createdAt": {
                        "type": "string"
                      }
                    }
                  }
                },
                "active": {
                  "type": "object",
                  "description": "The active device recording encryption key.",
                  "properties": {
                    "key": {
                      "type": "string"
                    },
                    "algorithm": {
                      "type": "string"
                    },
                    "confirmedByDevice": {
                      "type": "boolean"
                    },
                    "createdAt": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          }
        }
      },
      "getEncryptionKeyResponse": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "generatedKey"
              ],
              "properties": {
                "generatedKey": {
                  "type": "string",
                  "description": "Generated recording encryption key"
                }
              }
            }
          }
        }
      },
      "getDrivers": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "metadata"
              ],
              "properties": {
                "data": {
                  "type": "array",
                  "description": "The array of drivers in the specified organization.",
                  "items": {
                    "$ref": "#/components/schemas/driverResponseObject"
                  }
                },
                "metadata": {
                  "$ref": "#/components/schemas/metadata"
                }
              }
            }
          }
        }
      },
      "getOrganizationDefaultSettingsResponse": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "type": "object",
                  "description": "The current settings of devices in an organization object.",
                  "properties": {
                    "gpsWebhookUrl": {
                      "type": "string",
                      "description": "The destination URLs for GPS webhooks in JSON string format."
                    },
                    "eventWebhookUrl": {
                      "type": "string",
                      "description": "The destination URLs for event webhooks in JSON string format."
                    },
                    "eventWebhookConfig": {
                      "type": "string",
                      "description": "The events webhook configuration in JSON string format."
                    },
                    "alarmsWebhookUrl": {
                      "type": "string",
                      "description": "The destination URLs for alarms webhooks in JSON string format."
                    },
                    "alarmsWebhookConfig": {
                      "type": "string",
                      "description": "The alarms webhook configuration in JSON string format."
                    },
                    "systemMessagesWebhook": {
                      "type": "string",
                      "description": "The destination URLs and their configuration for system messages webhooks in JSON string format."
                    },
                    "events": {
                      "$ref": "#/components/schemas/eventConfig"
                    },
                    "device": {
                      "$ref": "#/components/schemas/deviceConfigResponse"
                    },
                    "isOrganizationProfileEnabled": {
                      "$ref": "#/components/schemas/isOrganizationProfileEnabled"
                    },
                    "deIdEnabled": {
                      "$ref": "#/components/schemas/deIdEnabled"
                    },
                    "deIdBacklogEnabled": {
                      "$ref": "#/components/schemas/deIdBacklogEnabled"
                    },
                    "deIdEnableStrictBlurring": {
                      "$ref": "#/components/schemas/deIdEnableStrictBlurring"
                    },
                    "enableAdasCalibration": {
                      "$ref": "#/components/schemas/enableAdasCalibration"
                    }
                  }
                },
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      },
      "getOrganizationDefaultPinCodeSettingsResponse": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/devicePinCodesResponse"
                },
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      },
      "getDeviceAuxiliaryCamerasBillingStatus": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "devices"
              ],
              "properties": {
                "devices": {
                  "type": "array",
                  "description": "The array of auxiliary camera billing statuses",
                  "items": {
                    "$ref": "#/components/schemas/auxBillingStatus"
                  }
                },
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      },
      "drivingHistoryResponse": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "metadata"
              ],
              "properties": {
                "data": {
                  "type": "array",
                  "description": "The array of drivers in the specified organization.",
                  "items": {
                    "type": "object",
                    "properties": {
                      "driverHistory": {
                        "type": "array",
                        "description": "The array of driver events according to the specified parameters.",
                        "items": {
                          "$ref": "#/components/schemas/driverHistoryResponseObject"
                        }
                      }
                    }
                  }
                },
                "metadata": {
                  "$ref": "#/components/schemas/metadata"
                }
              }
            }
          }
        }
      },
      "patchDeviceCameras": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "postAuthenticate": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "type": "object",
                  "description": "The authentication response",
                  "properties": {
                    "token": {
                      "$ref": "#/components/schemas/token"
                    },
                    "organizationId": {
                      "$ref": "#/components/schemas/organizationId"
                    }
                  }
                }
              }
            }
          }
        }
      },
      "postChangePassword": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "postForgotPassword": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "postResetPassword": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "putUserSettings": {
        "description": "Successful operation.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "postOrganizationDevicesCalibrateAccelerometer": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "patchDevice": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "getDevice": {
        "description": "Receive the device metadata.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "requestId"
              ],
              "properties": {
                "data": {
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/extendedDevice"
                    },
                    {
                      "type": "object",
                      "required": [
                        "organizationId",
                        "dataProfileId"
                      ],
                      "properties": {
                        "organizationId": {
                          "$ref": "#/components/schemas/organizationId"
                        },
                        "dataProfileId": {
                          "$ref": "#/components/schemas/dataProfileId"
                        }
                      }
                    }
                  ]
                },
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "putDeviceRetentionConfig": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "getDeviceRetentionConfig": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "data": {
                  "type": "object",
                  "description": "The recording retention time as requested",
                  "required": [
                    "config"
                  ],
                  "properties": {
                    "config": {
                      "$ref": "#/components/schemas/retentionConfig"
                    }
                  }
                }
              }
            }
          }
        }
      },
      "getDeviceCameras": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "type": "array",
                  "description": "The receive active cameras response array.",
                  "items": {
                    "type": "object",
                    "properties": {
                      "cameraId": {
                        "$ref": "#/components/schemas/cameraId"
                      }
                    }
                  }
                },
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      },
      "getDeviceCameraSnapshot": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/fileUrl"
                },
                "metadata": {
                  "type": "object",
                  "properties": {
                    "lat": {
                      "$ref": "#/components/schemas/latitude"
                    },
                    "lon": {
                      "$ref": "#/components/schemas/longitude"
                    },
                    "speed": {
                      "$ref": "#/components/schemas/speedMps"
                    },
                    "time": {
                      "$ref": "#/components/schemas/time"
                    }
                  }
                }
              }
            }
          }
        }
      },
      "getDeviceDataUsage": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/deviceDataUsage"
                }
              }
            }
          }
        }
      },
      "getDevicesDataUsage": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "description": "List of devices data usage response array.",
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/deviceDataUsage"
                  }
                }
              }
            }
          }
        }
      },
      "getOrganizationDevicesDataUsage": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "metadata",
                "requestId"
              ],
              "properties": {
                "data": {
                  "description": "List of Device Data Usage.",
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/deviceDataUsage"
                  }
                },
                "metadata": {
                  "$ref": "#/components/schemas/metadata"
                },
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      },
      "getOrganizationDevicesBillingStatus": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "metadata",
                "requestId"
              ],
              "properties": {
                "data": {
                  "description": "List of devices billing status response array.",
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/deviceBillingStatus"
                  }
                },
                "metadata": {
                  "$ref": "#/components/schemas/metadata"
                },
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "getOrganizationDefaultDataProfileResponse": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId",
                "data"
              ],
              "properties": {
                "data": {
                  "type": "object",
                  "description": "The ID of the data profile",
                  "properties": {
                    "defaultDataProfileId": {
                      "type": "number",
                      "title": "Device data profile ID",
                      "description": "The ID of the data profile",
                      "example": 123
                    }
                  }
                },
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "postWakeupDevice": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "putDeviceSemiOnline": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "putDeviceInDemoMode": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "deleteDeviceFromDemoMode": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "getDeviceRecordingRanges": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "type": "array",
                  "description": "The receive recordings availability response array.",
                  "items": {
                    "$ref": "#/components/schemas/cameraRangeObject"
                  }
                }
              }
            }
          }
        }
      },
      "deletePartnerContacts": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "getPartnerDevices": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId",
                "metadata"
              ],
              "properties": {
                "data": {
                  "description": "The receive organization devices response array.",
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/extendedDevice"
                  }
                },
                "metadata": {
                  "$ref": "#/components/schemas/metadata"
                },
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "patchPartnerContacts": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "postPartnerContacts": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/postPartnerContact"
            }
          }
        }
      },
      "postVirtualEvent": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "requestId"
              ],
              "properties": {
                "data": {
                  "type": "object",
                  "required": [
                    "eventId"
                  ],
                  "properties": {
                    "eventId": {
                      "type": "string",
                      "nullable": true,
                      "description": "The ID of the virtual event.",
                      "example": "a35bg-16fg3d8d-2f8g-75c21"
                    }
                  }
                },
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "putBulkEventConfig": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "putEventConfig": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "getEventConfig": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "title": "Events configuration object",
                  "description": "The events settings configuration of the device object.",
                  "type": "object",
                  "required": [
                    "vehicleType",
                    "events"
                  ],
                  "properties": {
                    "vehicleType": {
                      "$ref": "#/components/schemas/vehicleType"
                    },
                    "events": {
                      "type": "array",
                      "description": "The enabled events array. Any event types that are not in this list are disabled.",
                      "items": {
                        "$ref": "#/components/schemas/eventSettingObject"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "putDeviceConfig": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "data": {
                  "type": "object",
                  "properties": {
                    "effectedImeis": {
                      "type": "array",
                      "description": "The list of IMEIs affected by the config update.",
                      "items": {
                        "$ref": "#/components/schemas/imei"
                      }
                    },
                    "config": {
                      "$ref": "#/components/schemas/deviceConfigResponse"
                    }
                  }
                },
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      },
      "putCalibrateAdas": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "getCalibrateAdasState": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId",
                "data"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                },
                "data": {
                  "type": "string",
                  "description": "The state of the most recent request.",
                  "enum": [
                    "pending",
                    "completed",
                    "failed"
                  ]
                }
              }
            }
          }
        }
      },
      "getNewCalibrateAdasStatus": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId",
                "data"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                },
                "data": {
                  "type": "object",
                  "required": [
                    "measurements",
                    "status",
                    "featureStatuses"
                  ],
                  "properties": {
                    "measurements": {
                      "type": "object",
                      "required": [
                        "cameraHeight",
                        "cameraOffset",
                        "vehicleWidth"
                      ],
                      "properties": {
                        "cameraHeight": {
                          "type": "number",
                          "description": "The height of the device from the ground, in cm."
                        },
                        "cameraOffset": {
                          "type": "number",
                          "description": "The horizontal offset of the device from the center of the windshield, in cm. To the right of center is a positive number, while to the left of center is negative."
                        },
                        "vehicleWidth": {
                          "type": "number",
                          "description": "The vehicle rear axle width, with tires out, in cm."
                        }
                      }
                    },
                    "status": {
                      "type": "string",
                      "description": "The status of the calibration.",
                      "enum": [
                        "none",
                        "ready",
                        "completed"
                      ]
                    },
                    "featureStatuses": {
                      "type": "object",
                      "description": "The status of the calibration features.",
                      "properties": {
                        "rollingStopDetection": {
                          "type": "string",
                          "description": "The status of the \"rollingStopDetection\" event",
                          "enum": [
                            "pending",
                            "active"
                          ]
                        },
                        "followingDistance": {
                          "type": "string",
                          "description": "The status of the \"followingDistance\" event",
                          "enum": [
                            "pending",
                            "active"
                          ]
                        },
                        "criticalDistance": {
                          "type": "string",
                          "description": "The status of the \"criticalDistance\" event",
                          "enum": [
                            "pending",
                            "active"
                          ]
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "getAutoCalibrationStatus": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "status"
              ],
              "properties": {
                "status": {
                  "type": "string",
                  "description": "The status of the auto-calibration process.",
                  "enum": [
                    "pending",
                    "completed",
                    "failed",
                    "notStarted"
                  ]
                },
                "type": {
                  "type": "string",
                  "description": "The type of calibration.",
                  "enum": [
                    "auto",
                    "auto_recalibration",
                    "manual"
                  ]
                }
              }
            }
          }
        }
      },
      "getDeviceConfig": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/deviceConfigResponse"
                },
                "metadata": {
                  "$ref": "#/components/schemas/deviceConfigMetadataResponse"
                }
              }
            }
          }
        }
      },
      "getDevicePinCodes": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/devicePinCodesResponse"
                }
              }
            }
          }
        }
      },
      "deleteUser": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "patchUserOrganizationPermissions": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "postBulkDevices": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId",
                "data"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "86aa561d-cb00-4fb9-b0db-7968830f3864"
                },
                "data": {
                  "description": "The bulk add devices response array.",
                  "properties": {
                    "accepted": {
                      "type": "array",
                      "description": "A list of the device IMEIs that are accepted.",
                      "items": {
                        "$ref": "#/components/schemas/acceptedImei"
                      }
                    },
                    "rejected": {
                      "type": "array",
                      "description": "A list of the device IMEIs that are rejected.",
                      "items": {
                        "$ref": "#/components/schemas/rejectedImei"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "postDeviceReboot": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "postFactoryReset": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "postDeviceOtgSettings": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "enabled"
              ],
              "properties": {
                "enabled": {
                  "description": "Whether USB on-the-go (OTG) is enabled for the device",
                  "type": "boolean"
                }
              }
            }
          }
        }
      },
      "postAssociatedDevices": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "description": "The returned list of associated devices",
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/associatedDevices"
                  }
                },
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      },
      "getDeviceFormatStorage": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "postDeviceConnectMedia": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/connectMedia"
            }
          }
        }
      },
      "getDeviceEvents": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "metadata"
              ],
              "properties": {
                "data": {
                  "description": "The receive list of events response array.",
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/event"
                  }
                },
                "metadata": {
                  "$ref": "#/components/schemas/metadata"
                }
              }
            }
          }
        }
      },
      "getDeviceEvent": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/event"
                }
              }
            }
          }
        }
      },
      "deleteDeviceEvent": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/eventDeleted"
                }
              }
            }
          }
        }
      },
      "getDeviceGeoFences": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "description": "The receive list of geofences response array.",
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/geofence"
                  }
                }
              }
            }
          }
        }
      },
      "setDeviceGeoFences": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "getDeviceEventFileLink": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "description": "The link that is returned in the response",
                  "type": "object",
                  "required": [
                    "url"
                  ],
                  "properties": {
                    "url": {
                      "$ref": "#/components/schemas/fileUrl"
                    }
                  }
                }
              }
            }
          }
        }
      },
      "getDeviceEventManyFileLinks": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "description": "The link that is returned in the response",
                  "type": "object",
                  "required": [
                    "urls"
                  ],
                  "properties": {
                    "urls": {
                      "type": "array",
                      "items": {
                        "title": "Event link",
                        "description": "The event object for specific camera.",
                        "type": "object",
                        "required": [
                          "cameraId"
                        ],
                        "properties": {
                          "cameraId": {
                            "$ref": "#/components/schemas/cameraId"
                          },
                          "url": {
                            "$ref": "#/components/schemas/fileUrl"
                          },
                          "error": {
                            "type": "string",
                            "description": "The explanation of error concerning URL for specific camera."
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "getDeviceTrips": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "description": "The receive list of trips response array.",
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/trip"
                  }
                }
              }
            }
          }
        }
      },
      "getDeviceScore": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "type": "object",
                  "properties": {
                    "score": {
                      "description": "The safety score of the device.",
                      "type": "number",
                      "example": 0.56
                    }
                  }
                },
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      },
      "deleteDeviceNotificationRecipient": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "getDeviceGps": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "type": "array",
                  "description": "The receive GPS data response array.",
                  "items": {
                    "$ref": "#/components/schemas/gpsPoint"
                  }
                }
              }
            }
          }
        }
      },
      "getDeviceTelemetry": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/deviceTelemetry"
                }
              }
            }
          }
        }
      },
      "getDeviceCameraTelemetry": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/deviceCameraTelemetry"
                }
              }
            }
          }
        }
      },
      "getAdasCalibrationImages": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "requestId"
              ],
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/adasCalibrationImagesState"
                },
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "deleteAdasCalibrationImages": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "getOrganizationDevices": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "metadata"
              ],
              "properties": {
                "data": {
                  "description": "The receive organization devices response array.",
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/extendedDevice"
                  }
                },
                "metadata": {
                  "$ref": "#/components/schemas/metadata"
                }
              }
            }
          }
        }
      },
      "getOrganizationSso": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "token"
              ],
              "properties": {
                "token": {
                  "description": "The authentication token. Insert in the authorization header of other API calls. Valid for twenty four hours.",
                  "type": "string",
                  "example": "e3d53477-1f85-42c1-8ed0-2bb591700db8"
                }
              }
            }
          }
        }
      },
      "getOrganizations": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "description": "The receive list of organizations response array.",
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/organizationDetails"
                  }
                }
              }
            }
          }
        }
      },
      "getMe": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "description": "The persoal informaton that is returned in the response.",
                  "type": "object",
                  "required": [
                    "me",
                    "entity"
                  ],
                  "properties": {
                    "me": {
                      "description": "The personal information object.",
                      "oneOf": [
                        {
                          "$ref": "#/components/schemas/partner"
                        },
                        {
                          "$ref": "#/components/schemas/user"
                        }
                      ]
                    },
                    "entity": {
                      "$ref": "#/components/schemas/entity"
                    }
                  }
                }
              }
            }
          }
        }
      },
      "getOrganization": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/extendedSingleOrganization"
                }
              }
            }
          }
        }
      },
      "getAuditLogs": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "metadata"
              ],
              "properties": {
                "data": {
                  "description": "The receive organization audit logs response array.",
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/auditLog"
                  }
                },
                "metadata": {
                  "$ref": "#/components/schemas/metadata"
                }
              }
            }
          }
        }
      },
      "getOrganizationUsers": {
        "description": "Successful operation.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "users"
              ],
              "properties": {
                "users": {
                  "description": "list of users for the given organization Id",
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/user"
                  }
                }
              }
            }
          }
        }
      },
      "getOrganizationExternalUsers": {
        "description": "Successful operation.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "users"
              ],
              "properties": {
                "users": {
                  "description": "A list of the external users of a specific organization. External users must already have administrator permissions in their original organization and receive administrator permissions in the additional organization to which they are assigned.",
                  "type": "array",
                  "items": {
                    "type": "object",
                    "title": "External user",
                    "description": "The external user object.",
                    "required": [
                      "id",
                      "email",
                      "role"
                    ],
                    "properties": {
                      "id": {
                        "$ref": "#/components/schemas/userId"
                      },
                      "email": {
                        "$ref": "#/components/schemas/email"
                      },
                      "role": {
                        "$ref": "#/components/schemas/role"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "getOrganizationGroups": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "description": "The receive organization groups response array.",
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/group"
                  }
                }
              }
            }
          }
        }
      },
      "postOrganizationDevices": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "data": {
                  "type": "object",
                  "properties": {
                    "imei": {
                      "$ref": "#/components/schemas/imei"
                    },
                    "name": {
                      "$ref": "#/components/schemas/deviceName"
                    },
                    "groupId": {
                      "$ref": "#/components/schemas/groupId"
                    },
                    "cameras": {
                      "$ref": "#/components/schemas/cameras"
                    }
                  }
                },
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      },
      "postOrganizationGroups": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "postOrganizationGroupDevices": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "postOrganization": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "description": "The newly created organization",
              "type": "object",
              "required": [
                "organizationId",
                "ssoSecret"
              ],
              "properties": {
                "organizationId": {
                  "$ref": "#/components/schemas/organizationId"
                },
                "ssoSecret": {
                  "type": "string",
                  "description": "The signature used to validate requests.",
                  "example": "6955b3f79gbbdcbbfe5632304bb036f2749db3af19bc86ffaee0c47bfc44f6f8"
                }
              }
            }
          }
        }
      },
      "patchOrganization": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "postEventSettingsOrganization": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                },
                "data": {
                  "type": "object",
                  "$ref": "#/components/schemas/eventConfig"
                }
              }
            }
          }
        }
      },
      "postDeviceSettingsOrganization": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                },
                "data": {
                  "type": "object",
                  "$ref": "#/components/schemas/deviceConfig"
                }
              }
            }
          }
        }
      },
      "patchEventOrganization": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                },
                "data": {
                  "type": "object",
                  "$ref": "#/components/schemas/eventConfig"
                }
              }
            }
          }
        }
      },
      "postOrganizationWebhookSettings": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId",
                "data"
              ],
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/webhookConfig"
                },
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "getOrganizationWebhooks": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "description": "The newly configured webhooks",
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "type": "array",
                  "description": "The webhooks configured for the organization array.",
                  "items": {
                    "allOf": [
                      {
                        "$ref": "#/components/schemas/webhookId"
                      },
                      {
                        "$ref": "#/components/schemas/webhook"
                      }
                    ]
                  }
                }
              }
            }
          }
        }
      },
      "postOrganizationWebhook": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                },
                "webhookId": {
                  "type": "number",
                  "description": "The ID of the webhook.",
                  "example": 217
                }
              }
            }
          }
        }
      },
      "putOrganizationWebhooks": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "deleteOrganizationWebhooks": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "deleteOrganization": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "deleteOrganizationDevices": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "postOrganizationUsers": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId",
                "userId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                },
                "userId": {
                  "$ref": "#/components/schemas/userId"
                }
              }
            }
          }
        }
      },
      "postOrganizationExternalUser": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "deleteOrganizationExternalUser": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "getCurrentPartnerContacts": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "description": "The returned list of partners and contacts",
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "description": "The partner contact response array.",
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/extendedPartnerContact"
                  }
                }
              }
            }
          }
        }
      },
      "getPartnerContacts": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "description": "The receive partner contacts response array.",
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/extendedPartnerContact"
                  }
                }
              }
            }
          }
        }
      },
      "getDevicesHealth": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "metadata"
              ],
              "properties": {
                "data": {
                  "description": "The receive health reports response array.",
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/deviceHealth"
                  }
                },
                "metadata": {
                  "$ref": "#/components/schemas/metadata"
                }
              }
            }
          }
        }
      },
      "getDevicesDataUsageReport": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "metadata"
              ],
              "properties": {
                "data": {
                  "description": "The retrieved device data usage reports response array.",
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/deviceDataUsageResponseObject"
                  }
                },
                "metadata": {
                  "$ref": "#/components/schemas/metadata"
                }
              }
            }
          }
        }
      },
      "getRmaDevicesResponse": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "metadata"
              ],
              "properties": {
                "data": {
                  "description": "The RMA device report response arrays",
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/rmaDevice"
                  }
                },
                "metadata": {
                  "$ref": "#/components/schemas/metadata"
                },
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      },
      "getHealthRecipients": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "description": "The receive list of health report email recipients response array.",
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/extendedHealthRecipient"
                  }
                }
              }
            }
          }
        }
      },
      "postHealthRecipient": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/extendedHealthRecipient"
                }
              }
            }
          }
        }
      },
      "deleteHealthRecipient": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "getAlarms": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "description": "The Alarms report that was requested",
              "type": "object",
              "required": [
                "data",
                "metadata"
              ],
              "properties": {
                "data": {
                  "description": "The alarm data array.",
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/alarm"
                  }
                },
                "metadata": {
                  "$ref": "#/components/schemas/metadata"
                }
              }
            }
          }
        }
      },
      "getAlarm": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/alarm"
                }
              }
            }
          }
        }
      },
      "postAlarmAction": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/extendedAlarmAction"
                },
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      },
      "postAlarmComment": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/extendedAlarmComment"
                }
              }
            }
          }
        }
      },
      "getAlarmsRecipients": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "description": "The receive alarms report email recipients response array.",
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/extendedAlarmsRecipient"
                  }
                }
              }
            }
          }
        }
      },
      "postAlarmsRecipient": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/extendedAlarmsRecipient"
                }
              }
            }
          }
        }
      },
      "patchAlarmsRecipient": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data"
              ],
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/extendedAlarmsRecipient"
                }
              }
            }
          }
        }
      },
      "deleteAlarmsRecipient": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "getPartnerOperationalStatistics": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "requestId"
              ],
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/partnerOperationalStatistics"
                },
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      },
      "whiteLabelInformation": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "requestId"
              ],
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/whiteLabelConfiguration"
                },
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      },
      "patchDeviceEventReviewState": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "badRequestError": {
        "description": "Bad request error",
        "content": {
          "application/json": {
            "schema": {
              "title": "Bad request error",
              "allOf": [
                {
                  "$ref": "#/components/schemas/error"
                }
              ],
              "example": {
                "error": "BadRequestError",
                "message": "bad request error: {message}",
                "requestId": "11af5b37-e038-42e0-8dcf-dc8c4aefc000"
              }
            }
          }
        }
      },
      "getOrganizationAlbumImages": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "metadata"
              ],
              "properties": {
                "data": {
                  "description": "The album images that were requested",
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/imageRecords"
                  }
                },
                "metadata": {
                  "$ref": "#/components/schemas/metadataImageRecords"
                },
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      },
      "postAutoReCalibration": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "requestId"
              ],
              "properties": {
                "data": {
                  "type": "object",
                  "properties": {
                    "accepted": {
                      "type": "array",
                      "description": "A list of the device IMEIs that are accepted.",
                      "items": {
                        "type": "string",
                        "example": "357660101000198"
                      }
                    },
                    "rejected": {
                      "type": "array",
                      "description": "A list of the device IMEIs that are rejected.",
                      "items": {
                        "type": "object",
                        "required": [
                          "imei",
                          "reason"
                        ],
                        "properties": {
                          "imei": {
                            "type": "string",
                            "example": "357660101000198"
                          },
                          "reason": {
                            "type": "string",
                            "example": "reason"
                          }
                        },
                        "example": {
                          "imei": "357660101000198",
                          "reason": "reason"
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "getDriverQRcodeResponse": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "requestId"
              ],
              "properties": {
                "data": {
                  "type": "string",
                  "description": "The unique driver QR code as an inline base64 encoded .png image."
                },
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "simulatedAlarmResponse": {
        "description": "A simulated alarm was created.",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/simulatedAlarmResponseData"
                },
                "requestId": {
                  "type": "string"
                }
              }
            }
          }
        }
      },
      "notModifiedError": {
        "description": "Alarm was not created because there is an open alarm that is more urgent."
      },
      "unauthorizedError": {
        "description": "Unauthorized error",
        "content": {
          "application/json": {
            "schema": {
              "title": "Unauthorized error",
              "allOf": [
                {
                  "$ref": "#/components/schemas/error"
                }
              ],
              "example": {
                "error": "UnauthorizedError",
                "message": "unauthorized error",
                "requestId": "11af5b37-e038-42e0-8dcf-dc8c4aefc000"
              }
            }
          }
        }
      },
      "forbiddenError": {
        "description": "Forbidden error",
        "content": {
          "application/json": {
            "schema": {
              "title": "Forbidden error",
              "allOf": [
                {
                  "$ref": "#/components/schemas/error"
                }
              ],
              "example": {
                "error": "ForbiddenError",
                "message": "forbidden error",
                "requestId": "11af5b37-e038-42e0-8dcf-dc8c4aefc000"
              }
            }
          }
        }
      },
      "notFoundError": {
        "description": "Not found error",
        "content": {
          "application/json": {
            "schema": {
              "title": "Not found error",
              "allOf": [
                {
                  "$ref": "#/components/schemas/error"
                }
              ],
              "example": {
                "error": "NotFoundError",
                "message": "not found error: {message}",
                "requestId": "11af5b37-e038-42e0-8dcf-dc8c4aefc000"
              }
            }
          }
        }
      },
      "tooManyRequestsError": {
        "description": "Too many requests error - try again later",
        "content": {
          "application/json": {
            "schema": {
              "title": "Too many requests error",
              "allOf": [
                {
                  "$ref": "#/components/schemas/error"
                }
              ],
              "example": {
                "error": "tooManyRequestsError",
                "message": "too many requests: {message}",
                "requestId": "11af5b37-e038-42e0-8dcf-dc8c4aefc000"
              }
            }
          }
        }
      },
      "conflictError": {
        "description": "Conflict error",
        "content": {
          "application/json": {
            "schema": {
              "title": "Conflict error",
              "allOf": [
                {
                  "$ref": "#/components/schemas/error"
                }
              ],
              "example": {
                "error": "ConflictError",
                "message": "conflict error: {message}",
                "requestId": "11af5b37-e038-42e0-8dcf-dc8c4aefc000"
              }
            }
          }
        }
      },
      "expectationFailedError": {
        "description": "Expectation failed error",
        "content": {
          "application/json": {
            "schema": {
              "title": "Expectation failed error",
              "allOf": [
                {
                  "$ref": "#/components/schemas/error"
                }
              ],
              "example": {
                "error": "ExpectationFailedError",
                "message": "expectation failed error: {message}",
                "requestId": "11af5b37-e038-42e0-8dcf-dc8c4aefc000"
              }
            }
          }
        }
      },
      "internalServerError": {
        "description": "Internal server error",
        "content": {
          "application/json": {
            "schema": {
              "title": "Internal server error",
              "allOf": [
                {
                  "$ref": "#/components/schemas/error"
                }
              ],
              "example": {
                "error": "UnknownError",
                "message": "unknown error has occurred",
                "requestId": "11af5b37-e038-42e0-8dcf-dc8c4aefc000"
              }
            }
          }
        }
      },
      "LockedError": {
        "description": "Locked error",
        "content": {
          "application/json": {
            "schema": {
              "title": "Locked error",
              "allOf": [
                {
                  "$ref": "#/components/schemas/error"
                }
              ],
              "example": {
                "error": "Locked Error",
                "message": "Virtual event may not be created for a locked device",
                "requestId": "11af5b37-e038-42e0-8dcf-dc8c4aefc000"
              }
            }
          }
        }
      },
      "defaultSuccessResponse": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      },
      "defaultMultiResponse": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId",
                "data"
              ],
              "properties": {
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                },
                "data": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "array",
                      "description": "List of IMEIs that were successfully updated",
                      "items": {
                        "$ref": "#/components/schemas/imei"
                      }
                    },
                    "accepted": {
                      "type": "array",
                      "description": "List of IMEIs that were accepted but may be processed later",
                      "items": {
                        "$ref": "#/components/schemas/imei"
                      }
                    },
                    "rejected": {
                      "type": "array",
                      "description": "List of rejected IMEIs with error details",
                      "items": {
                        "type": "object",
                        "properties": {
                          "imei": {
                            "$ref": "#/components/schemas/imei"
                          },
                          "errorCode": {
                            "type": "integer",
                            "description": "Error code indicating the reason for rejection <br> 1000: Not authorized<br> 1001: device not found<br> 1002: Changes are not allowed on RMA'ed devices<br> 1003: Device locked<br> 1004: Not supported for AI-14<br> 5000: Unknown error",
                            "enum": [
                              1000,
                              1001,
                              1002,
                              1003,
                              1004,
                              5000
                            ]
                          },
                          "reason": {
                            "type": "string",
                            "description": "IMEI was not found"
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "getPrivacyConfigV2Response": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                },
                "data": {
                  "type": "object",
                  "required": [
                    "privacyConfig"
                  ],
                  "properties": {
                    "privacyConfig": {
                      "$ref": "#/components/schemas/privacyConfigV2"
                    }
                  }
                }
              }
            }
          }
        }
      },
      "GetBulkPrivacyControlObject": {
        "description": "Get Privacy mode for a device",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId",
                "privacyMode"
              ],
              "properties": {
                "data": {
                  "type": "object",
                  "properties": {
                    "privacyMode": {
                      "allOf": [
                        {
                          "description": "The device's privacy mode determines its activation.<br> **general**- Enables the privacy mode.<br> **disabled** - Disables the privacy mode.<br>"
                        },
                        {
                          "$ref": "#/components/schemas/privacyMode"
                        }
                      ]
                    }
                  }
                },
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      },
      "defaultRecipientNotificationSuccessResponse": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "recipients",
                "requestId"
              ],
              "properties": {
                "recipients": {
                  "type": "array",
                  "description": "The recipients array.",
                  "items": {
                    "$ref": "#/components/schemas/recipientNotificationObject"
                  }
                },
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      },
      "putDriversResponse": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId",
                "data"
              ],
              "properties": {
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                },
                "data": {
                  "type": "object",
                  "required": [
                    "requestId"
                  ],
                  "properties": {
                    "activeCount": {
                      "type": "string",
                      "description": "Number of active drivers."
                    },
                    "inactiveCount": {
                      "type": "string",
                      "description": "Number of inactive drivers."
                    }
                  }
                }
              }
            }
          }
        }
      },
      "getDeviceBillingStatusResponse": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId",
                "data"
              ],
              "properties": {
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                },
                "data": {
                  "type": "object",
                  "properties": {
                    "imei": {
                      "$ref": "#/components/schemas/imei"
                    },
                    "billingStatus": {
                      "$ref": "#/components/schemas/getBillingStatusString"
                    }
                  }
                }
              }
            }
          }
        }
      },
      "postDeviceWifiPasswordResponse": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId",
                "data"
              ],
              "properties": {
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                },
                "data": {
                  "type": "object"
                }
              }
            }
          }
        }
      },
      "postDeviceAuxiliaryCamerasBilling": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId",
                "data"
              ],
              "properties": {
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                },
                "data": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "description": "The accepted IMEI array.",
                      "type": "array",
                      "items": {
                        "title": "The accepted IMEI",
                        "description": "The IMEI which was accepted",
                        "type": "string",
                        "example": "357660101007029"
                      }
                    },
                    "rejected": {
                      "description": "The rejected IMEI array.",
                      "type": "array",
                      "items": {
                        "title": "Rejected IMEI",
                        "description": "The IMEI which was rejected along with the reason and an error code",
                        "type": "object",
                        "required": [
                          "imei",
                          "reason",
                          "errorCode"
                        ],
                        "properties": {
                          "imei": {
                            "$ref": "#/components/schemas/imei"
                          },
                          "reason": {
                            "description": "The reason for rejecting this IMEI",
                            "type": "string",
                            "example": "Pair the AUX cameras to a device before enabling billing"
                          },
                          "errorCode": {
                            "description": "Reject error codes: 400 - The auxilliary camera was not found (enable only), 404 - The IMEI was not found/Not authorized",
                            "type": "integer",
                            "example": 400
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "putBulkDevicesBillingStatusResponse": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId",
                "data"
              ],
              "properties": {
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                },
                "data": {
                  "type": "object",
                  "properties": {
                    "accepted": {
                      "description": "The accepted IMEI array.",
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/acceptedBillingImei"
                      }
                    },
                    "rejected": {
                      "description": "The rejected IMEI array.",
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/rejectedBillingImei"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "postScopedToken": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "requestId"
              ],
              "properties": {
                "data": {
                  "type": "object",
                  "required": [
                    "token"
                  ],
                  "properties": {
                    "token": {
                      "type": "string",
                      "description": "The scoped token.",
                      "example": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
                    }
                  }
                },
                "requestId": {
                  "type": "string",
                  "description": "The ID of the request.",
                  "example": "df5fg-45fgfdsg-45fg-45454"
                }
              }
            }
          }
        }
      },
      "patchOrgPrivacyConfig": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "data",
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                },
                "data": {
                  "$ref": "#/components/schemas/privacyConfigV2"
                }
              }
            }
          }
        }
      },
      "getOrganizationAlbumConfig": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "albumStatus"
              ],
              "properties": {
                "albumStatus": {
                  "type": "string",
                  "description": "The status of the album assigned to the organization.",
                  "example": "enabled",
                  "enum": [
                    "enabled",
                    "disabled"
                  ]
                }
              }
            }
          }
        }
      },
      "postAutoCalibrationConfig": {
        "description": "Successful operation",
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "requestId"
              ],
              "properties": {
                "requestId": {
                  "$ref": "#/components/schemas/requestId"
                }
              }
            }
          }
        }
      }
    },
    "parameters": {
      "oAuthClientIdPath": {
        "in": "path",
        "name": "clientId",
        "description": "The unique identifier of the OAuth client",
        "required": true,
        "schema": {
          "$ref": "#/components/schemas/oAuthClientId"
        }
      },
      "oAuthEntityTypePath": {
        "in": "path",
        "name": "entityType",
        "description": "The type of entity (partner, subpartner, or partnercontact)",
        "required": true,
        "schema": {
          "$ref": "#/components/schemas/oAuthEntityType"
        }
      },
      "oAuthEntityIdPath": {
        "in": "path",
        "name": "entityId",
        "description": "The unique identifier of the entity",
        "required": true,
        "schema": {
          "$ref": "#/components/schemas/oAuthEntityId"
        }
      },
      "imeiPath": {
        "in": "path",
        "name": "imei",
        "description": "The IMEI of the device. The IMEI number can be found on a sticker on the device itself or on the back of the device box.",
        "required": true,
        "schema": {
          "$ref": "#/components/schemas/imei"
        }
      },
      "cameraIdPath": {
        "in": "path",
        "name": "cameraId",
        "description": "The ID of the in-cab or road-facing lens, or any paired auxiliary camera.<br><br> 1 - road-facing lens, 2 - in-cab lens, 50+ - auxiliary cameras. Use 0 for all cameras, or with the cameraIds parameter for a list of specific cameras.",
        "required": true,
        "schema": {
          "type": "string",
          "description": "The ID of the in-cab or road-facing lens, or any paired auxiliary camera.<br><br> 1 - road-facing lens, 2 - in-cab lens, 50+ - auxiliary cameras. Use 0 for all cameras, or with the cameraIds parameter for a list of specific cameras.",
          "example": "2"
        }
      },
      "dataProfileIdPath": {
        "in": "path",
        "name": "dataProfileId",
        "description": "The device data profile ID",
        "required": true,
        "schema": {
          "$ref": "#/components/schemas/dataProfileIdString"
        }
      },
      "defaultDataProfileId": {
        "in": "path",
        "name": "defaultDataProfileId",
        "description": "Default Data Profile for the organization.",
        "required": true,
        "schema": {
          "$ref": "#/components/schemas/dataProfileIdString"
        }
      },
      "billingStatusPath": {
        "in": "path",
        "name": "billingStatus",
        "description": "The device billing status",
        "required": true,
        "schema": {
          "$ref": "#/components/schemas/billingStatusString"
        }
      },
      "partnerIdPath": {
        "in": "path",
        "name": "partnerId",
        "description": "The ID of the partner. Obtain this from GET /partner-contact.",
        "required": true,
        "schema": {
          "type": "string",
          "description": "The ID of the partner.",
          "example": "62"
        }
      },
      "partnerIdQuery": {
        "in": "query",
        "name": "partnerId",
        "description": "Filter by the partner ID that the user who performed the action is associated with. Obtain this from GET /partner-contact.",
        "required": false,
        "schema": {
          "type": "string",
          "description": "Filter by the ID of the partner.",
          "example": "62"
        }
      },
      "userTypeQuery": {
        "in": "query",
        "name": "userType",
        "description": "Filter the results based on the desired user type, whether partner or user. This is necessary because the same userId can be assigned to a partner and a user.",
        "required": false,
        "schema": {
          "type": "string",
          "enum": [
            "user",
            "partnerContact"
          ],
          "description": "Filter by the user type.",
          "example": "partnerContact"
        }
      },
      "entityQuery": {
        "in": "query",
        "name": "entityId",
        "description": "Filter the results based on desired entity. Filter by IMEI for devices, by orgId for organizations, or by userId for users. Retrieves changes made to the devices, organizations, or users associated with the ID provided.",
        "schema": {
          "type": "string",
          "description": "The ID of the entity.",
          "example": "123456"
        }
      },
      "entityTypeQuery": {
        "in": "query",
        "name": "entityType",
        "description": "Filter the results based on desired entity type, whether the operation was performed on a device, a user, a reseller, or an organization.",
        "schema": {
          "type": "string",
          "enum": [
            "user",
            "reseller",
            "device",
            "organization"
          ],
          "description": "The type of entity.",
          "example": "device"
        }
      },
      "entityOrgIdQuery": {
        "in": "query",
        "name": "entityOrganizationId",
        "description": "Filter the results based on the Organization ID of the entity. Search for entities belonging to a specific organization.",
        "schema": {
          "$ref": "#/components/schemas/organizationIdString"
        }
      },
      "entityPartnerIdQuery": {
        "in": "query",
        "name": "entityPartnerId",
        "description": "Filter the results based on the Partner ID of the entity. Search for entities belonging to a specific partner.",
        "schema": {
          "type": "string",
          "description": "The ID of the partner.",
          "example": "62"
        }
      },
      "partnerContactIdPath": {
        "in": "path",
        "name": "partnerContactId",
        "description": "The ID of the partner’s contact. Obtain this from GET /partner-contacts.",
        "required": true,
        "schema": {
          "type": "string",
          "description": "The ID of the partner’s contact.",
          "example": "62"
        }
      },
      "userIdPath": {
        "in": "path",
        "name": "userId",
        "description": "The ID of user.",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[0-9]\\d*$",
          "description": "The ID of the user.",
          "example": "62"
        }
      },
      "emailPath": {
        "in": "path",
        "name": "email",
        "description": "The email of a registered user",
        "required": true,
        "schema": {
          "$ref": "#/components/schemas/email"
        }
      },
      "tokenPath": {
        "in": "path",
        "name": "token",
        "description": "The token generated for a registered user for password reset",
        "required": true,
        "schema": {
          "$ref": "#/components/schemas/token"
        }
      },
      "orgIdPath": {
        "in": "path",
        "name": "orgId",
        "description": "The ID of the organization. Obtain this from GET /organizations.",
        "required": true,
        "schema": {
          "type": "string",
          "description": "The ID of the organization.",
          "example": "62"
        }
      },
      "statusOuery": {
        "in": "query",
        "name": "status",
        "description": "Driver Recognition Status.<br> - Familiar: The driver is recognized and authorized to drive fleet vehicles.<br> - Unfamiliar: The driver is not recognized or is unauthorized to drive fleet vehicles.<br> - Pending Review: The system is currently processing the image for identification.",
        "schema": {
          "type": "string",
          "enum": [
            "familiar",
            "unfamiliar",
            "pendingReview"
          ]
        }
      },
      "startTimeOuery": {
        "in": "query",
        "name": "startTime",
        "description": "The time, in ISO 8601 format, Filter images created from this time forward.<br>",
        "schema": {
          "type": "string",
          "format": "date-time",
          "example": "2020-01-01T14:48:00.000Z"
        }
      },
      "endTimeOuery": {
        "in": "query",
        "name": "endTime",
        "description": "The time, in ISO 8601 format, Filter images created until this time.<br>",
        "schema": {
          "type": "string",
          "format": "date-time",
          "example": "2020-01-01T14:48:00.000Z"
        }
      },
      "driverIdPath": {
        "in": "path",
        "name": "driverId",
        "description": "The unique ID of the driver. The ID is generated automatically by the Surfsight system when creating the driver in an organization. This is not the driver code that is used for assigning to devices. Obtain this from GET /drivers.",
        "required": true,
        "schema": {
          "$ref": "#/components/schemas/driverId"
        }
      },
      "orgIdQuery": {
        "in": "query",
        "name": "orgId",
        "description": "Filter by the organization ID that the user who performed the action is associated with. Obtain this from GET /organizations.",
        "required": false,
        "schema": {
          "$ref": "#/components/schemas/organizationIdString"
        }
      },
      "organizationIdQuery": {
        "in": "query",
        "name": "organizationId",
        "description": "Filter by the ID of the organization. Obtain this from GET /organizations.",
        "required": false,
        "schema": {
          "$ref": "#/components/schemas/organizationIdString"
        }
      },
      "organizationRequiredOnlyForPartnersQuery": {
        "in": "query",
        "name": "organizationId",
        "description": "Filter by the ID of the organization. Obtain this from GET /organizations. (When using partner token, Organization ID is required.)",
        "required": false,
        "schema": {
          "$ref": "#/components/schemas/organizationIdString"
        }
      },
      "partnerOrganizationIdQuery": {
        "in": "query",
        "name": "organizationId",
        "description": "Filter by the ID of the partner’s organization. Obtain this from GET /organizations. This is an optional parameter for partners.",
        "required": false,
        "schema": {
          "$ref": "#/components/schemas/organizationIdString"
        }
      },
      "webhookIdPath": {
        "in": "path",
        "name": "webhookId",
        "description": "The ID of the webhook.",
        "required": true,
        "schema": {
          "type": "string",
          "description": "The ID of the webhook.",
          "example": 1
        }
      },
      "eventIdPath": {
        "in": "path",
        "name": "eventId",
        "description": "The ID of the event. Obtain this from GET /devices/{imei}/events.",
        "required": true,
        "schema": {
          "type": "string",
          "description": "The ID of the event.",
          "example": "62"
        }
      },
      "groupIdPath": {
        "in": "path",
        "name": "groupId",
        "description": "The ID of the group. Obtain this from GET /organizations/{orgId}/devices. If a groupId of -1 is selected, the device will be added without being assigned to any group.",
        "required": true,
        "schema": {
          "type": "string",
          "description": "The ID of the group.",
          "example": "62"
        }
      },
      "groupIdQuery": {
        "in": "query",
        "name": "groupId",
        "description": "Filter by the ID of the group. Obtain this from GET /organizations/{orgId}/devices. If a groupId of -1 is selected, the device will be added without being assigned to any group.",
        "schema": {
          "type": "string",
          "description": "Filter by the ID of the group.",
          "example": "62"
        }
      },
      "recipientIdPath": {
        "in": "path",
        "name": "recipientId",
        "description": "The ID of the email recipient. Obtain this from GET /recipients/health.",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[1-9]\\d*$",
          "description": "The ID of the email recipient.",
          "example": "25"
        }
      },
      "timeQuery": {
        "in": "query",
        "name": "time",
        "required": false,
        "description": "The time, in ISO 8601 format.",
        "schema": {
          "$ref": "#/components/schemas/time"
        }
      },
      "startQuery": {
        "in": "query",
        "name": "start",
        "required": true,
        "description": "Filter by a start date and time, in ISO 8601 format.",
        "schema": {
          "$ref": "#/components/schemas/start"
        }
      },
      "endQuery": {
        "in": "query",
        "name": "end",
        "required": true,
        "description": "Filter by an end date and time, in ISO 8601 format.",
        "schema": {
          "$ref": "#/components/schemas/end"
        }
      },
      "startOptionalQuery": {
        "in": "query",
        "name": "start",
        "description": "Filter by a start date and time, in ISO 8601 format.",
        "schema": {
          "$ref": "#/components/schemas/start"
        }
      },
      "endOptionalQuery": {
        "in": "query",
        "name": "end",
        "description": "Filter by an end date and time, in ISO 8601 format.",
        "schema": {
          "$ref": "#/components/schemas/end"
        }
      },
      "userIdQuery": {
        "in": "query",
        "description": "Filter by the ID of the user.",
        "name": "userId",
        "required": false,
        "schema": {
          "$ref": "#/components/schemas/userIdString"
        }
      },
      "fileIdQuery": {
        "in": "query",
        "name": "fileId",
        "description": "Filter by the ID of the requested file. Obtain this from the /devices/{imei}/events call or calculate the unix timestamp (seconds from epoch) of the event (applicable only to virtual events).",
        "schema": {
          "$ref": "#/components/schemas/fileId"
        }
      },
      "fileTypeQuery": {
        "in": "query",
        "name": "fileType",
        "description": "Filter by the file type of the requested file. Obtain this from the /devices/{imei}/events call or set to the value of video/snapshot if the device configuration is predefined.",
        "schema": {
          "$ref": "#/components/schemas/fileType"
        }
      },
      "cameraIdQuery": {
        "in": "query",
        "name": "cameraId",
        "description": "Filter by the ID of the in-cab or road-facing lens, or any paired auxiliary camera for the requested file. Obtain this from the /devices/{imei}/events call or set to the ID of the desired view if the configuration of the device is predefined: 1 - road-facing lens, 2 - in-cab lens, 50+ - auxiliary cameras. Use 0 for all cameras, or with the cameraIds parameter for a list of specific cameras.",
        "schema": {
          "description": "Filter by the ID of the camera associated with the requested file. Obtain this from the /devices/{imei}/events call or set to the ID of the desired camera if the camera’s configuration is predefined: 1 - road-facing lens, 2 - in-cab lens, 50+ - auxiliary cameras. Use 0 for all cameras, or with the cameraIds parameter for a list of specific cameras.",
          "type": "string",
          "example": "1"
        }
      },
      "cameraIdsQuery": {
        "in": "query",
        "name": "cameraIds",
        "required": false,
        "description": "A list of the camera IDs, separated by a comma. This may include the in-cab or road-facing lens, or any paired auxiliary camera: 1 - road-facing lens, 2 - in-cab lens, 50+ - auxiliary cameras. The list of cameras can be used only if cameraId=0 is provided.",
        "schema": {
          "description": "A list of the camera IDs, separated by a comma. This may include the in-cab or road-facing lens, or any paired auxiliary camera: 1 - road-facing lens, 2 - in-cab lens, 50+ - auxiliary cameras. The list of cameras can be used only if cameraId=0 is provided.",
          "type": "string",
          "example": "1,2,51,52"
        }
      },
      "concealQuery": {
        "in": "query",
        "name": "conceal",
        "description": "When set to true, retrieves a link to a version of an event media file with faces or license plates blurred. This parameter is optional. It is available for integrations in Europe.",
        "schema": {
          "description": "When set to true, retrieves a link to a version of an event media file with faces or license plates blurred. This parameter is optional. It is available for integrations in Europe.",
          "type": "boolean",
          "example": true
        }
      },
      "nameQuery": {
        "in": "query",
        "name": "name",
        "description": "Filter by the name of the user.",
        "schema": {
          "type": "string",
          "description": "Filter by the name of the user.",
          "example": "Mike"
        }
      },
      "driverThirdPartyIdQuery": {
        "in": "query",
        "name": "driverThirdPartyId",
        "description": "Filter by the driver's third party ID. Obtain this ID from GET /drivers.",
        "schema": {
          "$ref": "#/components/schemas/driverThirdPartyId"
        }
      },
      "driverIdQuery": {
        "in": "query",
        "name": "driverId",
        "description": "The unique ID of the driver. The ID is generated automatically by the Surfsight system when creating the driver in an organization. This is not the driver code that is used for assigning to devices. Obtain this from GET /drivers.",
        "schema": {
          "$ref": "#/components/schemas/driverId"
        }
      },
      "driverFirstNameQuery": {
        "in": "query",
        "name": "driverFirstName",
        "description": "Filter by first name of the driver (regex case-insensitive).",
        "schema": {
          "type": "string",
          "description": "The first name of the driver."
        }
      },
      "driverLastNameQuery": {
        "in": "query",
        "name": "driverLastName",
        "description": "Filter by last name of the driver (regex case-insensitive).",
        "schema": {
          "type": "string",
          "description": "The last name of the driver."
        }
      },
      "imeiQuery": {
        "in": "query",
        "name": "imei",
        "description": "Filter by the IMEI number of the device. The IMEI number can be found on a sticker on the device or on the back of the device box.",
        "schema": {
          "type": "string",
          "description": "Filter by the IMEI number of the device. The IMEI number can be found on a sticker on the device or on the back of the device box.",
          "example": "12345678"
        }
      },
      "driverIsActiveQuery": {
        "in": "query",
        "name": "driverIsActive",
        "description": "Filter by active or inactive state of the driver.",
        "schema": {
          "type": "boolean",
          "description": "The active state of the driver."
        }
      },
      "locatedQuery": {
        "in": "query",
        "name": "located",
        "description": "Filter for located devices only.",
        "allowEmptyValue": true,
        "schema": {
          "type": "string",
          "description": "Filter for located devices only."
        }
      },
      "lastConnectedAtStartQuery": {
        "in": "query",
        "name": "lastConnectedAtStart",
        "required": false,
        "description": "Filter by the start date and time of when the device was last connected, in ISO 8601 format. This is required when lastConnectedAtEnd is provided.",
        "schema": {
          "$ref": "#/components/schemas/lastConnectedAt"
        }
      },
      "lastConnectedAtEndQuery": {
        "in": "query",
        "name": "lastConnectedAtEnd",
        "required": false,
        "description": "Filter by the end date and time of when the device was last connected, in ISO 8601 format. This is required when lastConnectedAtStart is provided.",
        "schema": {
          "$ref": "#/components/schemas/lastConnectedAt"
        }
      },
      "lastRecordingUpdatedAtStartQuery": {
        "in": "query",
        "name": "lastRecordingUpdatedAtStart",
        "required": false,
        "description": "Filter by the start date and time of when the device last updated recordings, in ISO 8601 format. This is required when lastRecordingUpdatedAtEnd is provided.",
        "schema": {
          "$ref": "#/components/schemas/lastRecordingUpdatedAt"
        }
      },
      "lastRecordingUpdatedAtEndQuery": {
        "in": "query",
        "name": "lastRecordingUpdatedAtEnd",
        "required": false,
        "description": "Filter by the end date and time of when the device last updated recordings, in ISO 8601 format. This is required when lastRecordingUpdatedAtEnd is provided.",
        "schema": {
          "$ref": "#/components/schemas/lastRecordingUpdatedAt"
        }
      },
      "lastRecordingHealthQuery": {
        "in": "query",
        "name": "lastRecordingHealth",
        "description": "Filter for devices by their recording health.<br> To filter for healthy devices use 1, for unhealthy devices use 0, and for non-tested devices use -1.<br> In the response the boolean values are returned as true (for healthy devices), false (for unhealthy devices) and null (for non-tested devices).",
        "allowEmptyValue": true,
        "schema": {
          "type": "string",
          "description": "Filter for devices by their recording health.<br><br> 1 - healthy devices, 0 - unhealthy devices, -1 - not tested devices.",
          "enum": [
            "1",
            "0",
            "-1"
          ]
        }
      },
      "billingStatusQuery": {
        "in": "query",
        "name": "billingStatus",
        "description": "Filter for devices by their Billing Status.<br> To filter for devices with \"Pending Activation\" as billing status, use \"pendingActivation\". For devices with \"Activated\" as billing status, use \"activated\". For devices with \"Suspended\" as billing status, use \"suspended\". For devices with \"Deactivated\" as billing status, use \"deactivated\". For devices with no billing status, use \"billingStatusNotSet\".<br>",
        "schema": {
          "title": "Billing Status",
          "description": "Filter for devices by their Billing Status. To filter for devices with \"Pending Activation\" as billing status, use \"pendingActivation\". For devices with \"Activated\" as billing status, use \"activated\". For devices with \"Suspended\" as billing status, use \"suspended\". For devices with \"Deactivated\" as billing status, use \"deactivated\". For devices with no billing status, use \"billingStatusNotSet\".",
          "type": "string",
          "enum": [
            "pendingActivation",
            "activated",
            "deactivated",
            "suspended",
            "billingStatusNotSet"
          ]
        }
      },
      "deviceHealthSortQuery": {
        "in": "query",
        "name": "sort",
        "required": false,
        "description": "Sort devices in the health report by specific parameters, such as device names or IMEI numbers.",
        "schema": {
          "title": "Sort device health",
          "description": "Sort devices in the health report by specific parameters, such as device names or IMEI numbers.",
          "type": "string",
          "enum": [
            "name",
            "imei",
            "lastConnectedAt",
            "lastRecordingHealth",
            "lastRecordingUpdatedAt"
          ]
        }
      },
      "alarmIdPath": {
        "in": "path",
        "name": "alarmId",
        "description": "The ID of the alarm. Obtain this from GET /alarms.",
        "required": true,
        "schema": {
          "type": "string",
          "description": "The ID of the alarm.",
          "pattern": "^[1-9]\\d*$",
          "example": "62"
        }
      },
      "alarmDefinitionNameQuery": {
        "in": "query",
        "name": "alarmDefinitionName",
        "required": false,
        "description": "Filter by the name of the alarm.",
        "schema": {
          "title": "Filter by the name of the alarm.",
          "type": "string",
          "minLength": 2
        }
      },
      "alarmDefinitionSeverityQuery": {
        "in": "query",
        "name": "alarmDefinitionSeverity",
        "required": false,
        "description": "Filter by the severity of the alarm.<br><br> 10 is the lease severe, and 60 is the most severe.",
        "schema": {
          "title": "Alarm severity",
          "type": "string",
          "enum": [
            "10",
            "20",
            "30",
            "40",
            "50",
            "60"
          ]
        }
      },
      "readFilterQuery": {
        "in": "query",
        "name": "read",
        "description": "Filter for alarms that are read.",
        "allowEmptyValue": true,
        "schema": {
          "title": "Read",
          "type": "string"
        }
      },
      "unreadFilterQuery": {
        "in": "query",
        "name": "unread",
        "description": "Filter for alarms that are unread.",
        "allowEmptyValue": true,
        "schema": {
          "title": "Unread",
          "type": "string"
        }
      },
      "closeFilterQuery": {
        "in": "query",
        "name": "close",
        "description": "Filter for alarms that are closed.",
        "allowEmptyValue": true,
        "schema": {
          "title": "Close",
          "type": "string"
        }
      },
      "openFilterQuery": {
        "in": "query",
        "name": "open",
        "description": "Filter for alarms that are open.",
        "allowEmptyValue": true,
        "schema": {
          "title": "Open",
          "type": "string"
        }
      },
      "alarmsSortQuery": {
        "in": "query",
        "name": "sort",
        "required": false,
        "description": "Sort alarms by specific parameters, such as device names or IMEI numbers.",
        "schema": {
          "title": "Sort for alarms",
          "description": "Sort alarms by specific parameters, such as device names or IMEI numbers.",
          "type": "string",
          "enum": [
            "name",
            "imei",
            "organizationName",
            "partnerName",
            "alarmDefinitionSeverity",
            "alarmDefinitionName",
            "createdAt"
          ]
        }
      },
      "previousMonthsQuery": {
        "in": "query",
        "name": "months",
        "required": false,
        "description": "The number of previous months to include in the statistical trends. The current month is included by default.",
        "schema": {
          "title": "Months",
          "type": "integer",
          "default": 1,
          "minimum": 0,
          "maximum": 36,
          "example": 2
        }
      },
      "previousWeeksQuery": {
        "in": "query",
        "name": "weeks",
        "required": false,
        "description": "The number of previous weeks to include in the statistical trends. The current week is included by default.",
        "schema": {
          "title": "Weeks",
          "type": "integer",
          "default": 1,
          "minimum": 0,
          "maximum": 156,
          "example": 5
        }
      },
      "eventStatusQuery": {
        "in": "query",
        "name": "status",
        "required": false,
        "description": "Filter by the event status",
        "schema": {
          "$ref": "#/components/schemas/eventStatus"
        }
      },
      "driversSortQuery": {
        "in": "query",
        "name": "sort",
        "description": "Sort the list of drivers.",
        "schema": {
          "title": "Sort",
          "description": "Sort the list of drivers by name, driver's license, or date they were added to the organization.",
          "type": "string",
          "enum": [
            "createdAt",
            "drivingLicense",
            "firstName",
            "lastName"
          ],
          "default": "createdAt"
        }
      },
      "drivingHistorySortQuery": {
        "in": "query",
        "name": "sort",
        "description": "Sort the driving history results.",
        "schema": {
          "title": "Sort",
          "description": "Sort the driving history results by the date on which either the device, vehicle, or driver was added to the organization.",
          "type": "string",
          "enum": [
            "createdAt"
          ],
          "default": "createdAt"
        }
      },
      "auxiliaryCamerasSearchlimitQuery": {
        "in": "query",
        "name": "limit",
        "description": "Set the maximum number of cameras for a search query. The number can be between 1 and 8. The default value is 4.",
        "schema": {
          "pattern": "^[1-8]$"
        }
      },
      "orderQuery": {
        "in": "query",
        "name": "order",
        "description": "Set the order that pagination results appear in - ascending or descending order.",
        "schema": {
          "title": "Order",
          "description": "Set the order that pagination results appear in - ascending or descending order.",
          "type": "string",
          "enum": [
            "asc",
            "desc"
          ],
          "default": "desc"
        }
      },
      "limitQuery": {
        "in": "query",
        "name": "limit",
        "description": "Set the maximum number of pagination results to receive.",
        "schema": {
          "description": "Set the maximum number of pagination results to receive.",
          "type": "string",
          "pattern": "^[1-9]\\d*$",
          "default": "0",
          "example": "1"
        }
      },
      "limitQueryMax2000": {
        "in": "query",
        "name": "limit",
        "description": "Set the maximum number of pagination results to receive.",
        "schema": {
          "description": "Set the maximum number of pagination results to receive.",
          "type": "integer",
          "maximum": 2000,
          "pattern": "^[1-9]\\d*$",
          "default": 100,
          "example": 56
        }
      },
      "imeiAlbumQuery": {
        "in": "query",
        "name": "imei",
        "schema": {
          "title": "IMEI",
          "description": "Images can be filtered using the IMEI parameter.<br> The IMEI represents the unique identifier of the device that captured the snapshot.<br> The IMEI number can be found on a sticker on the device itself or on the back of the device box.\n",
          "type": "string",
          "example": "357660101000198"
        }
      },
      "limitQueryMax200": {
        "in": "query",
        "name": "limit",
        "description": "Set the maximum number of pagination results to receive.",
        "schema": {
          "description": "Set the maximum number of pagination results to receive (1-200)",
          "type": "string",
          "pattern": "^([1-9]|[0-9][0-9]|1[0-9][0-9]|200)$",
          "default": "0",
          "example": "199"
        }
      },
      "limitQueryMax1500": {
        "in": "query",
        "name": "limit",
        "description": "Set the maximum number of pagination results to a value between 1 and 1500.",
        "schema": {
          "type": "integer",
          "maximum": 1500,
          "default": 0,
          "example": 1500
        }
      },
      "limitQueryMax1500WithDefaultValue1500": {
        "in": "query",
        "name": "limit",
        "description": "Set the maximum number of pagination results to a value between 1 and 1500.",
        "schema": {
          "type": "integer",
          "maximum": 1500,
          "default": 1500,
          "example": 1500
        }
      },
      "limitQueryDefault200": {
        "in": "query",
        "name": "limit",
        "description": "Set the maximum number of pagination results to receive, between 1 and 200.",
        "schema": {
          "description": "Set the maximum number of pagination results to receive, between 1 and 200.",
          "type": "string",
          "pattern": "^([1-9]|[0-9][0-9]|1[0-9][0-9]|200)$",
          "default": "200",
          "example": "20"
        }
      },
      "limitQueryDefault100Max200": {
        "in": "query",
        "name": "limit",
        "description": "Set the maximum number of pagination results to recieve, up to 200. The default is 100.",
        "schema": {
          "type": "integer",
          "default": 100,
          "maximum": 200,
          "example": 4
        }
      },
      "offsetQuery": {
        "in": "query",
        "name": "offset",
        "description": "Set the number of results to skip over before receiving pagination results.",
        "schema": {
          "description": "Set the number of results to skip over before receiving pagination results.",
          "type": "string",
          "pattern": "^[1-9]\\d*$",
          "default": "0",
          "example": "1"
        }
      },
      "offsetQueryMin0": {
        "in": "query",
        "name": "offset",
        "description": "Set the number of results to skip over before receiving pagination results.",
        "schema": {
          "description": "Set the number of results to skip over before receiving pagination results.",
          "type": "string",
          "pattern": "^[0-9]\\d*$",
          "default": "0",
          "example": "1"
        }
      },
      "getTelemetryDataQuery": {
        "in": "query",
        "name": "getTelemetryData",
        "description": "Set to false if the telemetry data is not required in the API response.",
        "schema": {
          "description": "Set to false if the telemetry data is not required in the API response.",
          "type": "boolean"
        }
      },
      "domainAddressPath": {
        "in": "path",
        "name": "whiteLabelDomainAddress",
        "description": "The domain address of your white label portal.",
        "required": true,
        "schema": {
          "type": "string",
          "description": "The domain address of your white label portal.",
          "example": "4mrvil9g37h0o897e7vq3anv4maey3.net-spi.com"
        }
      },
      "eventType": {
        "in": "path",
        "description": "Event type",
        "name": "eventType",
        "required": true,
        "schema": {
          "$ref": "#/components/schemas/eventType"
        }
      },
      "eventTypeQuery": {
        "in": "query",
        "description": "Event type in query",
        "name": "eventType",
        "schema": {
          "$ref": "#/components/schemas/eventType"
        }
      },
      "eventIdQuery": {
        "in": "query",
        "description": "Event ID in query",
        "name": "eventId",
        "schema": {
          "$ref": "#/components/schemas/eventId"
        }
      },
      "maximumAdasCalibrationImagesQuery": {
        "in": "query",
        "name": "max",
        "description": "The maximum number of ADAS calibration images to request.",
        "allowEmptyValue": true,
        "schema": {
          "title": "Maximum ADAS calibration images",
          "type": "integer",
          "default": 9,
          "minimum": 1,
          "maximum": 9,
          "example": 4
        }
      },
      "calibrateTypeQuery": {
        "in": "query",
        "name": "calibrationType",
        "description": "If the device is already auto-calibrated, `calibrationType=auto` returns the latest images specific to AutoCalibration, regardless of the device state.  \n- Note: `max` and `calibrationType` cannot be used together.\n",
        "schema": {
          "title": "Calibration Type",
          "type": "string",
          "example": "auto"
        }
      },
      "minimumTripDistanceQuery": {
        "in": "query",
        "name": "minimumDistance",
        "required": false,
        "description": "The minimum distance of the trip, in miles.",
        "schema": {
          "type": "number",
          "example": 0.62
        }
      },
      "rmaUpdatedAtStartQuery": {
        "in": "query",
        "name": "rmaUpdatedAtStart",
        "required": false,
        "description": "Filter by the date when the device is updated as RMA in ISO 8601 format.",
        "schema": {
          "$ref": "#/components/schemas/rmaUpdatedAt"
        }
      },
      "rmaUpdatedAtEndQuery": {
        "in": "query",
        "name": "rmaUpdatedAtEnd",
        "required": false,
        "description": "Filter by the end date when the device is updated as RMA in ISO 8601 format.",
        "schema": {
          "$ref": "#/components/schemas/rmaUpdatedAt"
        }
      },
      "deviceNameQuery": {
        "in": "query",
        "name": "deviceName",
        "description": "Filter by the name of the RMA device.",
        "schema": {
          "type": "string",
          "description": "Filter by the name of the RMA device.",
          "example": "0123456789ABCDEF"
        }
      },
      "organizationNameQuery": {
        "in": "query",
        "name": "organizationName",
        "description": "Filter by the name of the organization.",
        "schema": {
          "type": "string",
          "description": "Filter by the name of the organization.",
          "example": "Company Name"
        }
      },
      "rmaDeviceSortQuery": {
        "in": "query",
        "name": "sort",
        "required": false,
        "description": "Sort RMA device report by specific parameters, such as device names or IMEI numbers.",
        "schema": {
          "title": "Sort RMA device report",
          "description": "Sort devices in the report by specific parameters, such as device names or IMEI numbers.",
          "type": "string",
          "enum": [
            "organizationName",
            "imei",
            "rmaUpdatedAt",
            "deviceName"
          ]
        }
      }
    },
    "schemas": {
      "oAuthClientId": {
        "type": "string",
        "title": "OAuth Client ID",
        "description": "The unique identifier for an OAuth client, automatically generated during client creation",
        "example": "abc123def456",
        "minLength": 1
      },
      "oAuthClientName": {
        "type": "string",
        "title": "OAuth Client Name",
        "description": "Optional human-readable name for the OAuth client to help identify its purpose or integration",
        "example": "My Integration Client",
        "minLength": 1,
        "maxLength": 255
      },
      "oAuthClientSecret": {
        "type": "string",
        "title": "OAuth Client Secret",
        "description": "The secret key used for OAuth client authentication. This value is only returned upon client creation or secret rotation and should be stored securely.",
        "example": "secret_abc123xyz789",
        "minLength": 1
      },
      "oAuthEntityType": {
        "type": "string",
        "title": "OAuth Entity Type",
        "description": "The type of entity that the OAuth client is associated with. Determines the scope and permissions of the client.",
        "enum": [
          "partner",
          "subpartner",
          "partnercontact"
        ],
        "example": "partner"
      },
      "oAuthEntityId": {
        "type": "string",
        "title": "OAuth Entity ID",
        "description": "The unique identifier of the entity (partner, subpartner, or partner contact) that owns this OAuth client",
        "example": "entity789",
        "minLength": 1
      },
      "oAuthClientEnabled": {
        "type": "boolean",
        "title": "OAuth Client Enabled Status",
        "description": "Indicates whether the OAuth client is currently active and able to authenticate. Disabled clients cannot generate access tokens.",
        "example": true
      },
      "oAuthClientCreatedAt": {
        "type": "string",
        "format": "date-time",
        "title": "OAuth Client Creation Timestamp",
        "description": "The date and time when the OAuth client was originally created, in ISO 8601 format",
        "example": "2024-01-15T10:30:00Z"
      },
      "oAuthClientLastRefreshedAt": {
        "type": "string",
        "format": "date-time",
        "title": "OAuth Client Secret Last Refreshed",
        "description": "The date and time when the client secret was last rotated or refreshed, in ISO 8601 format",
        "example": "2024-01-15T10:30:00Z"
      },
      "oAuthClientObject": {
        "type": "object",
        "title": "OAuth Client Object",
        "description": "Complete OAuth client details including identification, status, and metadata",
        "properties": {
          "clientId": {
            "$ref": "#/components/schemas/oAuthClientId"
          },
          "clientName": {
            "$ref": "#/components/schemas/oAuthClientName"
          },
          "entityType": {
            "$ref": "#/components/schemas/oAuthEntityType"
          },
          "entityId": {
            "$ref": "#/components/schemas/oAuthEntityId"
          },
          "enabled": {
            "$ref": "#/components/schemas/oAuthClientEnabled"
          },
          "createdAt": {
            "$ref": "#/components/schemas/oAuthClientCreatedAt"
          },
          "lastRefreshedAt": {
            "$ref": "#/components/schemas/oAuthClientLastRefreshedAt"
          }
        }
      },
      "oAuthClientMetadata": {
        "type": "object",
        "title": "OAuth Client Metadata",
        "description": "Metadata about OAuth client quotas and usage",
        "properties": {
          "totalClientsIssued": {
            "type": "number",
            "description": "Total number of clients issued (including inactive)"
          },
          "maxClientsQuota": {
            "type": "number",
            "description": "Maximum active clients quota allowed per partner"
          },
          "totalActiveClients": {
            "type": "number",
            "description": "Total number of Active clients issued"
          }
        }
      },
      "webhookId": {
        "type": "object",
        "title": "Webhook id",
        "description": "Webhook id",
        "required": [
          "id"
        ],
        "properties": {
          "id": {
            "type": "number",
            "description": "Webhook id",
            "example": 217
          }
        }
      },
      "postDriver": {
        "type": "object",
        "title": "Create a new driver",
        "description": "Add a new driver to the organization.",
        "required": [
          "driverThirdPartyId"
        ],
        "properties": {
          "organizationId": {
            "$ref": "#/components/schemas/organizationIdRequiredForPartner"
          },
          "driverThirdPartyId": {
            "$ref": "#/components/schemas/driverThirdPartyId"
          },
          "drivingLicense": {
            "type": "string",
            "description": "The driver's driver's license number.",
            "example": "10203040",
            "minLength": 2
          },
          "firstName": {
            "type": "string",
            "description": "The first name of the driver.",
            "example": "John",
            "minLength": 2
          },
          "lastName": {
            "type": "string",
            "description": "The last name of the driver.",
            "example": "Doe",
            "minLength": 2
          }
        }
      },
      "patchDriver": {
        "type": "object",
        "title": "Update driver",
        "description": "Update details for a specified driver.",
        "required": [
          "id"
        ],
        "properties": {
          "id": {
            "type": "string",
            "description": "The unique ID of the driver that is automatically generated when the driver is created in the Surfsight system.",
            "example": "qwerty12345"
          },
          "organizationId": {
            "$ref": "#/components/schemas/organizationId"
          },
          "driverThirdPartyId": {
            "$ref": "#/components/schemas/driverThirdPartyId"
          },
          "drivingLicense": {
            "type": "string",
            "description": "The driver's driver's license number.",
            "example": "10203040"
          },
          "firstName": {
            "type": "string",
            "description": "The first name of the driver.",
            "example": "John"
          },
          "lastName": {
            "type": "string",
            "description": "The last name of the driver.",
            "example": "Doe"
          },
          "driverCode": {
            "type": "string",
            "description": "The unique 5-digit driver code that is used to assign the driver to a device (for check-in, for example). Driver check-in will be implemented in the future v3.12 firmware upgrade.",
            "example": "12345"
          }
        }
      },
      "putDriver": {
        "type": "object",
        "title": "Change the driver active state.",
        "description": "Update the isActive parameter for a specified driver.",
        "required": [
          "id",
          "isActive"
        ],
        "properties": {
          "id": {
            "type": "string",
            "description": "The unique ID of the driver. The ID is generated automatically when the driver is created in the Surfsight system.",
            "example": "qwerty12345"
          },
          "organizationId": {
            "$ref": "#/components/schemas/organizationId"
          },
          "isActive": {
            "type": "boolean",
            "description": "New driver active state."
          }
        }
      },
      "deleteDriver": {
        "type": "object",
        "title": "Delete driver",
        "description": "Delete the driver from the specified organization.",
        "required": [
          "id"
        ],
        "properties": {
          "id": {
            "type": "string",
            "description": "The unique ID of the driver. The ID is generated automatically when the driver is created in the Surfsight system.",
            "example": "qwerty12345"
          },
          "organizationId": {
            "$ref": "#/components/schemas/organizationId"
          }
        }
      },
      "driverResponseObject": {
        "type": "object",
        "title": "Driver",
        "description": "The driver profile, containing all metadata unique to the driver in the specified organization.",
        "required": [
          "driverThirdPartyId"
        ],
        "properties": {
          "id": {
            "type": "string",
            "description": "The unique ID of the driver. The ID is generated automatically when the driver is created in the Surfsight system.",
            "example": "qwerty12345"
          },
          "driverThirdPartyId": {
            "$ref": "#/components/schemas/driverThirdPartyId"
          },
          "drivingLicense": {
            "type": "string",
            "description": "The driver's driver's license number.",
            "example": "10203040"
          },
          "firstName": {
            "type": "string",
            "description": "The first name of the driver.",
            "example": "John"
          },
          "lastName": {
            "type": "string",
            "description": "The last name of the driver.",
            "example": "Doe"
          },
          "driverCode": {
            "type": "string",
            "description": "The unique 5-digit driver code that is used to assign the driver to a device (for check-in, for example). Driver check-in will be implemented in the future v3.12 firmware upgrade.",
            "example": "12345"
          },
          "imei": {
            "$ref": "#/components/schemas/imei"
          },
          "isActive": {
            "type": "boolean",
            "description": "Active or inactive state of the driver."
          }
        }
      },
      "auxBillingStatus": {
        "type": "object",
        "title": "Aux billing",
        "description": "Current auxiliary camera billing status",
        "required": [
          "imei",
          "auxBillingStatus",
          "auxBillingStatusUpdatedAt"
        ],
        "properties": {
          "imei": {
            "$ref": "#/components/schemas/imei"
          },
          "auxBillingStatus": {
            "$ref": "#/components/schemas/getAuxBillingStatusString"
          },
          "auxBillingStatusUpdatedAt": {
            "description": "The date when the billing status was changed",
            "type": "string",
            "format": "date-time",
            "nullable": true
          }
        }
      },
      "driverDeviceAssignment": {
        "type": "object",
        "title": "Driver to device assignment",
        "description": "Assign a driver to a specific device in order to associate relevant trip and event data with the assigned driver. This can be done in advance of an impending trip or alternatively, retroactively.",
        "required": [
          "driverThirdPartyId",
          "imei"
        ],
        "properties": {
          "driverThirdPartyId": {
            "$ref": "#/components/schemas/driverThirdPartyIdInRequestBody"
          },
          "organizationId": {
            "$ref": "#/components/schemas/organizationIdRequiredForPartner"
          },
          "imei": {
            "$ref": "#/components/schemas/imei"
          },
          "startTime": {
            "title": "Assignment start time",
            "description": "The time, in ISO 8601 format, at which the driver assignment begins for the specified device.",
            "type": "string",
            "format": "date-time",
            "example": "2021-12-14T12:42:04.323Z"
          },
          "endTime": {
            "title": "Assignment end time",
            "description": "The time, in ISO 8601 format, at which the driver assignment ends for the specified device.",
            "type": "string",
            "format": "date-time",
            "example": "2021-12-14T14:09:53.876Z"
          }
        }
      },
      "driverThirdPartyId": {
        "type": "string",
        "description": "The third party ID of the driver in an organization.",
        "example": "moshe123"
      },
      "driverThirdPartyIdInRequestBody": {
        "type": "string",
        "description": "The third party ID of the driver in an organization. Retrieve this from GET /drivers.",
        "example": "moshe123"
      },
      "driverId": {
        "type": "string",
        "description": "The unique ID of the driver. The ID is generated automatically by the Surfsight system when creating the driver in an organization. This is not the driver code that is used for assigning to devices. Obtain this from GET /drivers.",
        "example": "qwerty12345"
      },
      "driverHistoryResponseObject": {
        "type": "object",
        "properties": {
          "driver": {
            "$ref": "#/components/schemas/driverResponseObject"
          },
          "startTime": {
            "title": "Assignment start time",
            "description": "The time, in ISO 8601 format, at which the driver assignment begins for the specified device.",
            "type": "string",
            "format": "date-time",
            "example": "2021-12-14T12:42:04.323Z"
          },
          "endTime": {
            "title": "Assignment end time",
            "description": "The time, in ISO 8601 format, at which the driver assignment ends for the specified device.",
            "type": "string",
            "format": "date-time",
            "example": "2021-12-14T14:09:53.876Z"
          }
        }
      },
      "calibrationCompleted": {
        "title": "Accelerometer calibration state",
        "description": "Whether the accelerometer is calibrated ",
        "type": "boolean"
      },
      "adasCalibrationReady": {
        "title": "ADAS calibration images availability/Device is partially calibrated (AI-14 version >= 14.4)",
        "description": "AI-12 and AI-14 (version < 14.4) - Whether there are at least 5 ADAS calibration images available in the device. <br>AI-14(version >= 14.4) - Device is partially calibrated.",
        "type": "boolean"
      },
      "adasCalibrationCompleted": {
        "title": "ADAS calibration state",
        "description": "Whether the ADAS is calibrated ",
        "type": "boolean"
      },
      "auxiliaryCamerasCount": {
        "title": "Number of Auxiliary Cameras",
        "description": "Number of Auxiliary Cameras connected to the device",
        "type": "number"
      },
      "deviceHealthAuxiliaryCamera": {
        "title": "Auxiliary camera",
        "description": "Auxiliary camera connected to the device",
        "type": "object",
        "properties": {
          "id": {
            "title": "Auxiliary camera ID",
            "description": "The ID of the auxiliary camera",
            "type": "string",
            "example": "51"
          },
          "lastConnectedAt": {
            "title": "Last connection time of the auxiliary camera",
            "description": "The last date and time that the auxiliary camera was connected, in ISO 8601 format",
            "type": "string",
            "format": "date-time",
            "example": "2021-12-14T14:09:53.876Z"
          },
          "auxSerial": {
            "title": "Aux camera serial number(v3.14+)",
            "description": "Aux camera serial number",
            "type": "string",
            "example": "L7660101000198"
          }
        }
      },
      "alarm": {
        "type": "object",
        "title": "Alarm",
        "description": "The alarm object.",
        "required": [
          "id"
        ],
        "properties": {
          "id": {
            "$ref": "#/components/schemas/alarmId"
          },
          "details": {
            "description": "The details of the alarm.",
            "type": "string",
            "example": "cyclic_recorder_status: 4, last_video_record_time: 1600683797"
          },
          "organizationId": {
            "$ref": "#/components/schemas/organizationId"
          },
          "organizationName": {
            "$ref": "#/components/schemas/organizationName"
          },
          "partnerId": {
            "$ref": "#/components/schemas/partnerId"
          },
          "partnerName": {
            "$ref": "#/components/schemas/partnerName"
          },
          "userId": {
            "$ref": "#/components/schemas/userId"
          },
          "alarmDefinitionId": {
            "$ref": "#/components/schemas/alarmDefinitionId"
          },
          "createdAt": {
            "description": "The date that the alarm was created, in ISO format.",
            "type": "string",
            "format": "date-time"
          },
          "lastReadAt": {
            "description": "The date that the alarm was last read, in ISO format.",
            "type": "string",
            "format": "date-time"
          },
          "lastCloseAt": {
            "description": "The date that the alarm was last closed, in ISO format.",
            "type": "string",
            "format": "date-time"
          },
          "comments": {
            "description": "The comments array.",
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/extendedAlarmComment"
            }
          },
          "actions": {
            "description": "The actions array.",
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/extendedAlarmAction"
            }
          }
        }
      },
      "alarmAction": {
        "type": "object",
        "title": "Alarm action",
        "description": "The alarm action object.",
        "required": [
          "type"
        ],
        "properties": {
          "type": {
            "$ref": "#/components/schemas/alarmActionType"
          }
        }
      },
      "extendedAlarmAction": {
        "title": "Alarm action - extended",
        "description": "The extended alarm action object.",
        "allOf": [
          {
            "$ref": "#/components/schemas/alarmAction"
          },
          {
            "type": "object",
            "required": [
              "id",
              "alarmId",
              "createdByAudienceName",
              "createdById",
              "updatedAt",
              "createdAt"
            ],
            "properties": {
              "id": {
                "type": "integer",
                "description": "The ID of the alarm comment.",
                "example": 125
              },
              "alarmId": {
                "$ref": "#/components/schemas/alarmId"
              },
              "createdByAudienceName": {
                "$ref": "#/components/schemas/audienceName"
              },
              "createdById": {
                "type": "integer",
                "description": "The ID of the user who created the alarm comment.",
                "example": 625
              },
              "updatedAt": {
                "description": "The date that the alarm was updated, in ISO format.",
                "type": "string",
                "format": "date-time"
              },
              "createdAt": {
                "description": "The date that the alarm comment was created, in ISO format.",
                "type": "string",
                "format": "date-time"
              }
            }
          }
        ]
      },
      "alarmActionType": {
        "title": "Alarm action type",
        "type": "string",
        "enum": [
          "open",
          "close",
          "read",
          "unread"
        ]
      },
      "alarmComment": {
        "type": "object",
        "title": "Alarm comment",
        "description": "The alarm comment object.",
        "required": [
          "details"
        ],
        "properties": {
          "details": {
            "type": "string",
            "description": "The details provided in the alarm comment.",
            "example": "comment about the alarm"
          }
        }
      },
      "extendedAlarmComment": {
        "title": "Alarm comment - extended",
        "description": " The extended alarm comment object.",
        "allOf": [
          {
            "$ref": "#/components/schemas/alarmComment"
          },
          {
            "type": "object",
            "required": [
              "id",
              "createdAt"
            ],
            "properties": {
              "id": {
                "type": "integer",
                "description": "The ID of the alarm comment.",
                "example": 34
              },
              "alarmId": {
                "$ref": "#/components/schemas/alarmId"
              },
              "createdByAudienceName": {
                "$ref": "#/components/schemas/audienceName"
              },
              "createdById": {
                "type": "integer",
                "description": "The ID of the user who created the alarm comment.",
                "example": 9
              },
              "createdAt": {
                "description": "The date that the alarm comment was created, in ISO format.",
                "type": "string",
                "format": "date-time"
              },
              "commentorName": {
                "type": "string",
                "description": "Some name",
                "example": "Commentor name"
              }
            }
          }
        ]
      },
      "alarmDefinition": {
        "type": "object",
        "title": "Alarm definition",
        "description": "The alarm definition object.",
        "properties": {
          "id": {
            "$ref": "#/components/schemas/alarmDefinitionId"
          },
          "name": {
            "type": "string",
            "description": "The name of the alarm.",
            "example": "Hardware failure: Unable to start device sensor and record video"
          },
          "severity": {
            "type": "number",
            "description": "The severity of the alarm. Alarms severities range between 10 and 60, with 10 being the least severe and 60 being the most severe.",
            "example": 60
          },
          "recommendation": {
            "type": "string",
            "description": "The recommendation to resolve the alarm.",
            "example": "Contact partner reseller support to return the unit"
          }
        }
      },
      "alarmDefinitionId": {
        "title": "Alarm definition Id",
        "description": "The ID of the alarm definition.",
        "type": "number",
        "example": 625
      },
      "alarmDefinitionCode": {
        "title": "Alarm definition code",
        "description": "The code of the alarm definition.",
        "type": "number",
        "example": 1001
      },
      "alarmId": {
        "title": "Alarm ID",
        "description": "The ID of the alarm.",
        "type": "number",
        "example": 625
      },
      "alarmsRecipient": {
        "title": "Alarms report email recipient",
        "description": "The alarms report email recipient object.",
        "type": "object",
        "properties": {
          "email": {
            "$ref": "#/components/schemas/email"
          },
          "reportIntervalSeconds": {
            "$ref": "#/components/schemas/alarmsReportIntervalSeconds"
          },
          "alarmDefinitions": {
            "description": "The alarm definition array.",
            "type": "array",
            "items": {
              "type": "object",
              "description": "The alarm definition object.",
              "required": [
                "id"
              ],
              "properties": {
                "id": {
                  "type": "number",
                  "description": "The ID of the alarm.",
                  "example": 625
                },
                "name": {
                  "type": "string",
                  "description": "The name of the alarm.",
                  "example": "Hardware failure: Unable to start camera sensor and record video"
                }
              }
            }
          }
        }
      },
      "extendedAlarmsRecipient": {
        "title": "Alarms report email recipient - extended",
        "description": "The extended alarms report email recipient object.",
        "allOf": [
          {
            "$ref": "#/components/schemas/alarmsRecipient"
          },
          {
            "type": "object",
            "required": [
              "id"
            ],
            "properties": {
              "id": {
                "$ref": "#/components/schemas/recipientId"
              },
              "createdByAudienceName": {
                "$ref": "#/components/schemas/audienceName"
              },
              "createdById": {
                "type": "integer",
                "description": "The ID of the audience name entity.",
                "example": 23
              },
              "targetEntity": {
                "$ref": "#/components/schemas/targetEntity"
              },
              "targetId": {
                "type": "integer",
                "description": "The ID of the target entity.",
                "example": 27
              },
              "lastReportAt": {
                "description": "The last report date, in ISO format.",
                "type": "string",
                "format": "date-time"
              }
            }
          }
        ]
      },
      "altitude": {
        "title": "Altitude",
        "description": "The GPS altitude.",
        "type": "number",
        "maximum": 10000,
        "example": 234.22
      },
      "altitudeOptional": {
        "title": "Altitude",
        "description": "The GPS altitude. This value is returned for the AI-12 only.",
        "type": "number",
        "maximum": 10000,
        "example": 234.22
      },
      "associatedDevices": {
        "type": "object",
        "title": "Associated devices",
        "description": "The associated devices object.",
        "required": [
          "imei",
          "associatedDevice"
        ],
        "properties": {
          "imei": {
            "$ref": "#/components/schemas/imei"
          },
          "associatedDevice": {
            "description": "The ID of the associated device.",
            "type": "string",
            "nullable": true,
            "example": "G0AA321E0817"
          },
          "db": {
            "description": "The database to which the associated device belongs.",
            "type": "string",
            "nullable": true,
            "example": "5org4757988"
          }
        }
      },
      "audienceName": {
        "type": "string",
        "title": "Audience entity",
        "description": "The type of entity.",
        "enum": [
          "surfsight",
          "organization",
          "partner"
        ]
      },
      "auditLog": {
        "type": "object",
        "title": "Audit log",
        "description": "The audit logs object.",
        "required": [
          "id",
          "message",
          "reason"
        ],
        "properties": {
          "id": {
            "type": "number",
            "description": "The ID of the group.",
            "example": 461
          },
          "message": {
            "type": "string",
            "description": "The operation that was executed.",
            "example": "devicePrivacySettingsModification"
          },
          "reason": {
            "type": "string",
            "description": "The reason for which the operation was executed.",
            "example": "updateDevicePrivacyConfig"
          },
          "createdAt": {
            "description": "The creation date and time of the audit log, in ISO format.",
            "type": "string",
            "format": "date-time",
            "example": "2021-08-10T10:35:00.000Z"
          },
          "value": {
            "description": "The parameter values set in the executed operation.",
            "type": "string",
            "example": "{\\\"gpsEnabled\\\":true,\\\"mvaiEnabled\\\":true,\\\"liveStreamEnabled\\\":true}"
          },
          "previousValue": {
            "description": "The parameter values that were set before the executed operation.",
            "type": "string",
            "example": "{\\\"gpsEnabled\\\":false,\\\"mvaiEnabled\\\":false,\\\"liveStreamEnabled\\\":false}"
          },
          "organizationId": {
            "description": "The organization ID that the user who performed the action is associated with. Obtain this from GET /organizations.",
            "type": "string",
            "example": "311"
          },
          "organizationName": {
            "type": "string",
            "minLength": 1,
            "description": "The organization name that the user who performed the action is associated with.",
            "example": "Amazing organization"
          },
          "partnerId": {
            "description": "The partner ID that the user who performed the action is associated with. Obtain this from GET /partner-contacts.",
            "type": "string",
            "example": "13"
          },
          "partnerName": {
            "type": "string",
            "description": "The partner name that the user who performed the action is associated with",
            "example": "James"
          },
          "userId": {
            "description": "The ID of the user.",
            "type": "string",
            "example": "23"
          },
          "userName": {
            "type": "string",
            "description": "The name assigned to the user.",
            "example": "Harry"
          },
          "imei": {
            "type": "string",
            "description": "The IMEI number of the device. The IMEI number can be found on a sticker on the device itself or on the back of the device box.",
            "example": "468771212171905"
          },
          "entityId": {
            "type": "string",
            "description": "The id of the entity.",
            "example": "468771212171905"
          },
          "entityTpe": {
            "type": "string",
            "description": "entityType specifies the type of entity to which the change was made.",
            "enum": [
              "device",
              "user",
              "reseller",
              "organization"
            ]
          },
          "entityOrganizationId": {
            "type": "number",
            "description": "The organizationId associated with entity to which the change was made.",
            "example": "311"
          },
          "entityPartnerId": {
            "type": "number",
            "description": "The partnerId associated with entity to which the change was made.",
            "example": "13"
          },
          "source": {
            "type": "string",
            "description": "The source of the request.",
            "enum": [
              "whiteLabelPortal",
              "adminPortal",
              "partnerPortal",
              "geotabPortal",
              "apiV2",
              "apiV1"
            ]
          },
          "method": {
            "type": "string",
            "description": "API request method: GET, POST, PUT, PATCH, or DELETE.",
            "enum": [
              "GET",
              "POST",
              "PUT",
              "PATCH",
              "DELETE"
            ]
          },
          "endpoint": {
            "type": "string",
            "description": "API endpoint that receives the request.",
            "example": "/devices/357660101000198/device-config"
          },
          "queryParams": {
            "type": "string",
            "description": "Query parameters that were sent with the request.”",
            "example": "{\"imei\":\"357660101000198\", userId: \"12345\"}"
          },
          "requestId": {
            "$ref": "#/components/schemas/requestId"
          }
        }
      },
      "cameraId": {
        "title": "Camera ID",
        "description": "The ID of the camera.<br><br> 1 - road-facing lens, 2 - in-cab lens, 50+ - auxiliary cameras.",
        "type": "number",
        "example": 1
      },
      "cameraRangeObject": {
        "title": "Camera recordings intervals",
        "description": "The camera ID and time intervals of any available recordings object.",
        "type": "object",
        "required": [
          "cameraId",
          "intervals"
        ],
        "properties": {
          "cameraId": {
            "type": "number",
            "description": "The ID of the camera attached to the device.<br><br> 1 - road-facing lens, 2 - in-cab lens, 50+ - auxiliary cameras.",
            "example": 1
          },
          "intervals": {
            "type": "array",
            "description": "The time intervals of any available recordings for a specific camera array.",
            "items": {
              "type": "object",
              "required": [
                "start",
                "end"
              ],
              "properties": {
                "start": {
                  "$ref": "#/components/schemas/start"
                },
                "end": {
                  "$ref": "#/components/schemas/end"
                }
              }
            }
          }
        }
      },
      "connectionStatus": {
        "title": "Connection status",
        "description": "The device connection status.<br><br> When online, the device is fully functional. When in standby, the device is connected to the cloud, but live streaming is not available. When offline, the device is not connected to the cloud.",
        "type": "string",
        "enum": [
          "online",
          "standby",
          "offline"
        ]
      },
      "dataType": {
        "title": "Data type",
        "description": "The type of data that is attached to an event when the event is generated. This data may not be attached to the event if there is too much data being used. <br>The following events are only available as text, without video or snapshot:<br> <ul>accOff</ul> <ul>accOn</ul> <ul>geoFence</ul> <ul>speedLimit</ul> <ul>ignitionOn - sending a data type other than `none` will cause an error.</ul> <ul>ignitionOff - sending a data type other than `none` will cause an error.</ul> <ul>thermalShutdownEnter - sending a data type other than `none` will cause an error.</ul>",
        "type": "string",
        "enum": [
          "none",
          "snapshot",
          "video"
        ]
      },
      "weight": {
        "title": "Event scoring weight",
        "description": "The weight given to the event. <br><br> This parameter is part of our future roadmap and is currently disabled. When it is enabled, we will let you know in the release notes.",
        "type": "integer",
        "minimum": 0,
        "maximum": 5,
        "example": 3
      },
      "numberOfBeepsBeforeEvent": {
        "title": "Number beeps played before creating the event",
        "description": "Select the number of beeps made by the device before creating the event. <br>Supports AI-14 (FW 14.4+) and AI-12 (FW 3.14+) devices.<br> <br>This parameter is applicable only for the following events.<br> <ul>distractedDriving</ul> <ul>foodDrink</ul> <ul>cellPhoneUse</ul> <ul>smoking</ul> <ul>obstruction</ul> <br>Default values<br> <table> <thead> <tr> <th>Event</th><th>Default number of beeps</th> </tr> </thead> <tbody> <tr> <td>distractedDriving</td><td>2</td> </tr> <tr> <td>foodDrink</td><td>2</td> </tr> <tr> <td>cellPhoneUse</td><td>3</td> </tr> <tr> <td>smoking</td><td>4</td> </tr> <tr> <td>obstruction</td><td>4</td> </tr> </tbody> </table>",
        "type": "integer",
        "minimum": 1,
        "maximum": 6,
        "example": 2
      },
      "minimumSpeedToCreateEvent": {
        "title": "Minimum speed to create the event",
        "description": "The minimum speed of the vehicle required to create the event. <br>Supports AI-14 (FW 14.4+) and AI-12 (FW 3.14+) devices.<br> <br>This parameter is applicable only for the following events<br> <ul>distractedDriving</ul> <ul>smoking</ul> <ul>foodDrink</ul> <ul>cellPhoneUse</ul> <ul>obstruction</ul> <ul>driverUnbelted</ul> <ul>passengerUnbelted</ul>",
        "type": "integer",
        "minimum": 0,
        "maximum": 180,
        "default": 5,
        "example": 60
      },
      "deviceDataUsage": {
        "title": "Data usage",
        "description": "Receives the data usage of the device for the current billing period.",
        "type": "object",
        "required": [
          "imei",
          "mobileTx",
          "mobileRx",
          "liveStreamingUsage",
          "eventsUsage",
          "liveStreamUsageMilli",
          "recordStreamUsageMilli",
          "recordStreamingUsage",
          "recordingsUploadUsage",
          "usageEventsTodayDay",
          "usageEventsTodayMonth",
          "receivedAt"
        ],
        "properties": {
          "imei": {
            "$ref": "#/components/schemas/imei"
          },
          "mobileTx": {
            "type": "number",
            "description": "The total data transmitted from the device, in bytes, for the current calendar month.",
            "example": 1742802650
          },
          "mobileRx": {
            "type": "number",
            "example": 105125084,
            "description": "The total data received by the device, in bytes, for the current calendar month."
          },
          "liveStreamingUsage": {
            "type": "number",
            "example": 1509793264,
            "description": "The amount of data used from live video streaming, in bytes, for the current calendar month."
          },
          "eventsUsage": {
            "type": "number",
            "example": 49707444,
            "description": "The amount of data used from uploading video events, in bytes, for the current calendar month."
          },
          "liveStreamUsageMilli": {
            "type": "number",
            "example": 25026908,
            "description": "The amount of time spent watching live video streaming, in milliseconds, for the current calendar month."
          },
          "recordStreamingUsage": {
            "type": "number",
            "example": 14869072,
            "description": "The amount of data used from streaming recordings, in bytes, for the current calendar month."
          },
          "recordingsUploadUsage": {
            "type": "number",
            "example": 0,
            "description": "The amount of data used from uploading recordings, in bytes, for the current calendar month."
          },
          "usageEventsTodayDay": {
            "type": "number",
            "description": "The number of video events that have occurred today.",
            "example": 3
          },
          "usageEventsTodayMonth": {
            "type": "number",
            "description": "The number of video events that have occurred, for the current calendar month.",
            "example": 44
          },
          "recordStreamUsageMilli": {
            "type": "number",
            "description": "The amount of time spent watching recordings, in milliseconds, for the current calendar month.",
            "example": 25026908
          },
          "receivedAt": {
            "$ref": "#/components/schemas/time"
          },
          "billingDayOfMonth": {
            "type": "number",
            "description": "The day of the month on which the device data plan is billed.",
            "example": 1
          },
          "mobileProvider": {
            "type": "object",
            "description": "The data usage details for mobile provider and data plan for the current month.",
            "properties": {
              "carrier": {
                "description": "The name of the mobile provider.",
                "type": "string",
                "enum": [
                  "twilio",
                  "AT&T"
                ],
                "example": "twilio"
              },
              "uniqueName": {
                "description": "An application-defined string that uniquely identifies the resource. It can be used in place of the resource's sid in the URL to address the resource.",
                "type": "string",
                "example": "Lytx Fleet 2 GB Limit"
              },
              "dataLimit": {
                "description": "The total data usage (download and upload combined) in Megabytes that each Super SIM assigned to the Fleet can consume during a billing period (normally one month). Value must be between 1MB (1) and 2TB (2,000,000). Defaults to 1GB (1,000).",
                "type": "number",
                "example": 1000
              },
              "dataUsage": {
                "description": "The data usage details from the mobile provider.",
                "type": "object",
                "properties": {
                  "dataTotal": {
                    "description": "Total amount of data uploaded and data downloaded, combined.",
                    "type": "number",
                    "example": 100
                  },
                  "dataUpload": {
                    "description": "Total data uploaded in bytes, aggregated by the query parameters.",
                    "type": "number",
                    "example": 90
                  },
                  "dataDownload": {
                    "description": "Total data downloaded in bytes, aggregated by the query parameters.",
                    "type": "number",
                    "example": 10
                  },
                  "period": {
                    "description": "The time period for which the usage is reported. The period is represented as a pair of startTime and endTime timestamps specified in ISO 8601 format.",
                    "type": "object",
                    "properties": {
                      "startTime": {
                        "$ref": "#/components/schemas/time"
                      },
                      "endTime": {
                        "$ref": "#/components/schemas/time"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "deviceBillingStatus": {
        "title": "Billing status",
        "description": "Receive the billing status of the device.",
        "type": "object",
        "required": [
          "imei",
          "billingStatus"
        ],
        "properties": {
          "imei": {
            "$ref": "#/components/schemas/imei"
          },
          "billingStatus": {
            "$ref": "#/components/schemas/getBillingStatusString"
          }
        }
      },
      "eventDeleted": {
        "title": "Deleted event",
        "description": "The deleted event object.",
        "type": "object",
        "required": [
          "eventId",
          "time"
        ],
        "properties": {
          "eventId": {
            "$ref": "#/components/schemas/eventId"
          },
          "time": {
            "$ref": "#/components/schemas/time"
          }
        }
      },
      "device": {
        "type": "object",
        "title": "Device",
        "description": "The device object.",
        "required": [
          "name",
          "imei"
        ],
        "properties": {
          "name": {
            "$ref": "#/components/schemas/deviceName"
          },
          "imei": {
            "$ref": "#/components/schemas/imei"
          },
          "groupId": {
            "$ref": "#/components/schemas/groupId"
          }
        }
      },
      "extendedDevice": {
        "title": "Device - extended",
        "description": "The extended device object.",
        "allOf": [
          {
            "$ref": "#/components/schemas/device"
          },
          {
            "type": "object",
            "required": [
              "cameras",
              "vehicleType"
            ],
            "properties": {
              "accuracy": {
                "$ref": "#/components/schemas/accuracy"
              },
              "vehicleType": {
                "description": "The type of vehicle associated with the device.<br><br> The type of vehicle affects the sensitivity of the device's motion sensor. Private is the most sensitive to movements, and trailer is the least sensitive.",
                "type": "string",
                "enum": [
                  "Private",
                  "Van",
                  "Trailer"
                ]
              },
              "lat": {
                "$ref": "#/components/schemas/latitude"
              },
              "lon": {
                "$ref": "#/components/schemas/longitude"
              },
              "alt": {
                "$ref": "#/components/schemas/altitude"
              },
              "speed": {
                "$ref": "#/components/schemas/speedMps"
              },
              "status": {
                "$ref": "#/components/schemas/connectionStatus"
              },
              "lastSeenOnline": {
                "$ref": "#/components/schemas/lastSeenOnline"
              },
              "firmwareVersion": {
                "$ref": "#/components/schemas/firmwareVersion"
              },
              "deviceModel": {
                "$ref": "#/components/schemas/deviceModel"
              },
              "cameras": {
                "description": "The cameras array.\n",
                "type": "array",
                "items": {
                  "description": "The camera object",
                  "type": "object",
                  "required": [
                    "cameraId"
                  ],
                  "properties": {
                    "cameraId": {
                      "description": "The ID of the camera.<br><br> 1 - road-facing lens, 2 - in-cab lens, 50+ - auxiliary cameras.",
                      "type": "number",
                      "example": 1
                    },
                    "name": {
                      "description": "The name assigned to the camera.",
                      "type": "string",
                      "example": "Harry's truck"
                    }
                  }
                }
              },
              "iccid": {
                "type": "string",
                "description": "The number of the device's SIM card.",
                "example": "891004234814455936F"
              },
              "liveVideoTimeoutSeconds": {
                "type": "number",
                "description": "The amount of time that live video is streamed, in seconds.",
                "example": 30
              },
              "isSemiOnline": {
                "description": "Semi-online state of the device (AI-14 version 14.4 and later and the supported modem).",
                "type": "boolean"
              }
            }
          }
        ]
      },
      "alarmsReportIntervalSeconds": {
        "title": "Device alarm report interval",
        "description": "The frequency of the device alarms report, in seconds. To receive a report email every hour, the value should be 3600.",
        "type": "number",
        "example": 3600
      },
      "deviceCameraTelemetry": {
        "title": "Device camera telemetry",
        "description": "The camera telemetry object.",
        "type": "object",
        "required": [
          "status",
          "code"
        ],
        "properties": {
          "status": {
            "description": "The status of the camera stream download.\n",
            "type": "string",
            "example": "the download is not yet in progress or just completed"
          },
          "code": {
            "description": "The status code of the camera stream download. Value options:\nCODE1 - the live stream is ready\nCODE2 - the live stream is not yet in progress or just completed\nCODE3 - the downloading recording is ready\nCODE4 - the downloading recording is not yet started or just completed\nCODE5 - the download is not yet in progress or just completed\n",
            "type": "string",
            "example": "CODE5",
            "enum": [
              "CODE1",
              "CODE2",
              "CODE3",
              "CODE4",
              "CODE5"
            ]
          }
        }
      },
      "deviceConfig": {
        "title": "Device configuration",
        "description": "The device configuration object for request.",
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "adas": {
            "description": "The road-facing ADAS calibration status.",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "The calibration status of the road-facing advanced driver assistance system (ADAS).",
                "type": "boolean"
              }
            }
          },
          "distractedDriver": {
            "description": "Distracted driver alerts",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "In-cabin audio and visual alerts when distracted driving events, such as cell phone usage, eating and drinking, or smoking, occur.",
                "type": "boolean"
              }
            }
          },
          "liveVideo": {
            "description": "Live video streaming",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "Live video streaming from the device.",
                "type": "boolean"
              }
            }
          },
          "driverCamera": {
            "description": "In-cab lens",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "Turn the in-cab lens (the driver-facing side of the camera) on or off. If the in-cab lens is off, all configurations related to the in-cab recording will not work; this includes distracted driver events and in-cab recording.",
                "type": "boolean"
              }
            }
          },
          "textOverlay": {
            "description": "Text overlay for recordings",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "The text overlay to appear in video recordings and events.",
                "type": "boolean"
              }
            }
          },
          "inCabinCameraRecording": {
            "description": "In-cab recording.",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "Turn the in-cabin recordings on/off. The distracted driver feature works whether or not the recordings are on.",
                "type": "boolean"
              }
            }
          },
          "driverPosition": {
            "description": "Side of driver seat",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "The side of the driver seat - the left or right side of the vehicle. Must be set correctly for the distracted driver setting to work properly.",
                "type": "string",
                "enum": [
                  "left",
                  "right"
                ]
              }
            }
          },
          "speedUnits": {
            "description": "Speed units",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "The unit used to measure speed - miles or kilometers per hour.",
                "type": "string",
                "enum": [
                  "mph",
                  "kmh"
                ]
              }
            }
          },
          "audioAlarms": {
            "description": "Audio alerts",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "Audio alerts from the device for dangerous and distracted driving events.",
                "type": "boolean"
              }
            }
          },
          "notifyLiveStreaming": {
            "description": "Live video streaming notification",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "The on-screen text notification that appears when someone is viewing live video of the device from the cloud.",
                "type": "boolean"
              }
            }
          },
          "adminPin": {
            "description": "Admin PIN",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "The PIN code used by administrators to access the device and all of its menus and options.",
                "type": "string",
                "example": "1234"
              }
            }
          },
          "driverPin": {
            "description": "Driver PIN",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "The driver PIN. This is the unique 4-digit number that any driver can use to access the recordings for a specific device.",
                "type": "string",
                "example": "4321"
              }
            }
          },
          "brightness": {
            "description": "Screen brightness",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "Set the brightness of the screen of the device, on a linear scale where 0 is dark and 255 is maximum brightness.",
                "type": "integer",
                "example": 128,
                "minimum": 0,
                "maximum": 255
              }
            }
          },
          "dateTimeUnits": {
            "description": "Date and time units",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "The unit of measurement for date and time. Choose \"us\" - US units, or \"eu\" - metric units.",
                "type": "string",
                "enum": [
                  "us",
                  "eu"
                ]
              }
            }
          },
          "voiceRecording": {
            "description": "Audio recording",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "Set whether to record audio in the vehicle.",
                "type": "boolean"
              }
            }
          },
          "standby": {
            "description": "Standby",
            "type": "object",
            "required": [
              "timeout"
            ],
            "properties": {
              "timeout": {
                "description": "The amount of time, in minutes, after the vehicle stops moving, when the camera enters Standby mode. (1-60)<br> (The 1-1440 minute value range is supported on the AI-12 from firmware version 3.14 and on the AI-14 from firmware version 14.2.111.)",
                "type": "integer",
                "example": 10,
                "minimum": 1,
                "maximum": 1440
              }
            }
          },
          "hotSpot": {
            "$ref": "#/components/schemas/hotSpot"
          },
          "recordingEncryption": {
            "description": "Recording encryption",
            "type": "object",
            "required": [
              "enabled"
            ],
            "properties": {
              "enabled": {
                "description": "The state of recording encryption. True is enabled, false is disabled.",
                "type": "boolean"
              },
              "password": {
                "description": "Recording Encryption Key<br>\nThe encryption key is essential for enabling encryption.<br>\nIt must adhere to the length requirements of 16, 24, or 32 characters, as stipulated by the Advanced Encryption Standard (AES) for the AES-256-CBC algorithm.\nA 44-character length is also available from version 3.13.2 for the AI-12 and from 14.4.0 for the AI-14.\nThe AES-256-CBC algorithm supports three key sizes: 128 bits, 192 bits, and 256 bits.\n",
                "type": "string",
                "example": "]cTQ0TNJ[sZb{5TKL4J_+(&z4@C7j~+.",
                "pattern": "^(.{16}|.{24}|.{32}|[0-9a-zA-Z+\\/]{40}[0-9a-zA-Z+\\/]{2}==|[0-9a-zA-Z+\\/]{40}[0-9a-zA-Z+\\/]{3}=|[0-9a-zA-Z+\\/]{44})$"
              }
            }
          },
          "privacy": {
            "description": "Privacy settings **(These settings are in use until the first time the device privacy mode is enabled or disabled\")**",
            "type": "object",
            "properties": {
              "gpsEnabled": {
                "description": "The GPS tracking.",
                "type": "boolean"
              },
              "mvaiEnabled": {
                "description": "MVAI, machine vision and artificial intelligence, to identify distracted driving.",
                "type": "boolean"
              },
              "liveStreamEnabled": {
                "description": "Allow viewing of live video streamed from the device.",
                "type": "boolean"
              },
              "allEventsEnabled": {
                "description": "Allow the device to create any event, and audio and visual alerts, as configured for this device. When set to false, no events are created, and in-cabin alerts are not triggered.",
                "type": "boolean"
              },
              "cameras": {
                "description": "The cameras array.",
                "type": "array",
                "items": {
                  "description": "The privacy settings for a specific camera object.",
                  "type": "object",
                  "required": [
                    "cameraId"
                  ],
                  "properties": {
                    "cameraId": {
                      "$ref": "#/components/schemas/cameraId"
                    },
                    "recordingEnabled": {
                      "description": "Enable or disable recording for the camera.",
                      "type": "boolean"
                    },
                    "eventsEnabled": {
                      "description": "Include or exclude media from this camera in events.",
                      "type": "boolean"
                    }
                  }
                }
              }
            }
          },
          "pinCodeDi": {
            "description": "Driver identification code",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "Enable or disable driver identification (and assignment) through a unique code specific to that driver. Driver identification can be enabled either through this driver code or a QR code, but not both. Driver check-in will be implemented with the future v3.12 firmware upgrade.",
                "type": "boolean"
              }
            }
          },
          "qrDi": {
            "description": "QR code driver identification",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "Enable or disable driver identification (and assignment) through a QR code specific to that driver (the same as the driver code, in QR code format). Driver identification can be enabled either through this QR code or a driver code, but not both. Used for driver check-in, which will be implemented with the future v3.12 firmware upgrade.",
                "type": "boolean"
              }
            }
          },
          "driverIdentification": {
            "description": "Driver idenfication with qrDi or pinCodeDi is enabled",
            "type": "object",
            "properties": {
              "driverPrompt": {
                "description": "Driver prompt on device for driver to check-in, unless the device is associated with a driver, in which case the prompt will not occur. If enabled, a driver is prompted to check in when the device exits standby mode.",
                "type": "boolean"
              },
              "audioAlert": {
                "description": "Enable or disable audio beeps while driver prompt flashes on the device. This is only an option when driverPrompt is enabled.",
                "type": "boolean"
              },
              "driverPromptDurationSeconds": {
                "description": "Driver prompt duration in seconds. Time intervals between 10 and 60 seconds can be customized. This is required when driverPrompt is enabled and not permitted to send when the driverPrompt is disabled ",
                "type": "integer",
                "example": 30,
                "minimum": 10,
                "maximum": 60
              }
            }
          },
          "virtualIgnition": {
            "description": "When virtual ignition is enabled, the device enters and exits standby mode based on motion. When disabled, the device enters and exits standby mode based on the vehicle ignition.",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "When virtual ignition is enabled, the device enters and exits standby mode based on motion. When disabled, the device enters and exits standby mode based on the vehicle ignition.",
                "type": "boolean"
              }
            }
          },
          "screenTimeout": {
            "description": "Screen timeout",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "Set the time period, in seconds, before the device screen turns off automatically.",
                "type": "integer",
                "example": 120,
                "minimum": 10,
                "maximum": 300
              }
            }
          },
          "passengerLimit": {
            "description": "Passenger Limit",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "Set the total number of passengers allowed in the cabin, including the driver. This call is currently in beta; contact your Technical Account Manager for more information.",
                "type": "integer",
                "example": 1,
                "minimum": 1,
                "maximum": 4
              }
            }
          },
          "wakeupMsg": {
            "description": "The message to inform the driver they are being recorded, after the device wakes up.",
            "type": "object",
            "required": [
              "enabled"
            ],
            "properties": {
              "enabled": {
                "description": "The state of wake-up splash message. True is enabled, false is disabled.",
                "type": "boolean"
              },
              "timeout": {
                "description": "The number of seconds to display the message to the driver.",
                "type": "integer",
                "default": 10,
                "minimum": 1,
                "maximum": 300
              }
            }
          },
          "ledEnabled": {
            "description": "Enable LED functionality for AI-14 devices. This feature is available for AI-14 devices with firmware 14.2.111 or above.",
            "type": "object",
            "properties": {
              "value": {
                "description": "The state of LED functionality. True is enabled, false is disabled.",
                "type": "boolean",
                "default": true
              }
            }
          },
          "setTimezoneByCloud": {
            "description": "Enable or disable device retrieval of time zone information from the cloud, based on GPS location.",
            "type": "object",
            "properties": {
              "value": {
                "description": "When setTimezoneByCloud is enabled, the device retrieves time zone information from the cloud, based on GPS location. When disabled, the device retrieves time zone information from the cellular provider. True is enabled, false is disabled.",
                "type": "boolean"
              }
            }
          }
        }
      },
      "deviceConfigMetadataResponse": {
        "title": "Device configuration metadata",
        "description": "The device configuration metadata object for response.",
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "source": {
            "description": "The source of the configuration. When the device is online, the data comes from the device. When the device is offline, the data comes from the last configuration saved in the cloud.",
            "type": "string",
            "enum": [
              "cloud",
              "device"
            ]
          },
          "status": {
            "$ref": "#/components/schemas/connectionStatus"
          },
          "time": {
            "title": "The configuration retrieval time, in ISO 8601 format",
            "description": "When the device is online, the time is when data was retrieved from the device. When the device is offline, the time is from the last configuration saved in the cloud.",
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "privacyConfigV2": {
        "title": "Privacy configuration parameters",
        "type": "object",
        "properties": {
          "gpsTracking": {
            "description": "When disabled, GPS data will not be sent to the cloud, GPS data will not be written on media sent to the cloud, trip data will not be available, geofence and speed events will not be created, and events will be created and reported without a location. Note that Passenger Limit and Driver ID related events will not be created, as they depend on GPS data.",
            "type": "string",
            "enum": [
              "enabled",
              "disabled"
            ],
            "default": "disabled"
          },
          "liveVideo": {
            "description": "When disabled, live video from the device is not supported.",
            "type": "string",
            "enum": [
              "enabled",
              "disabled"
            ],
            "default": "disabled"
          },
          "cabinEvents": {
            "description": "Enable/Disable in-cabin MVAI events creation.<br><br> Events included: <li>distractedDriving <li>smoking <li>foodDrink <li>cellPhoneUse <li>driverUnbelted <li>obstruction <li>possibleFatigue <li>fatigue <li>passengerUnbelted <li>passengerLimit <li>yawn",
            "type": "string",
            "enum": [
              "enabled",
              "disabled"
            ],
            "default": "disabled"
          },
          "cabinLensVideo": {
            "description": "When disabled, the in-cabin lens video will not be recorded on the device, nor attached to created events.<br> **NOTE: In the event of an accidents during this time, there will not be any video records available.**",
            "type": "string",
            "enum": [
              "enabled",
              "disabled"
            ],
            "default": "disabled"
          },
          "cabinBeepAlerts": {
            "description": "In-cabin audio and visual alerts to alert the driver prior to event creation.<br> **NOTE: In-cabin audio alerts to alert the driver prior to event creation. visual alerts are currently not configurable through privacy mode settings.**",
            "type": "string",
            "enum": [
              "enabled",
              "disabled"
            ],
            "default": "disabled"
          },
          "voiceRecording": {
            "description": "Audio recording on a device.",
            "type": "string",
            "enum": [
              "enabled",
              "disabled"
            ],
            "default": "disabled"
          },
          "roadAndAuxEvents": {
            "description": "ADAS events creation.<br><br> Events included: <li>tailgating <li>laneWeaving <li>followingDistance <li>criticalDistance <li>rollingStop",
            "type": "string",
            "enum": [
              "enabled",
              "disabled"
            ],
            "default": "disabled"
          },
          "roadAndAuxLensVideo": {
            "description": "When disabled, road-facing and AUX lenses videos will not be recorded on the device, nor attached to created events.",
            "type": "string",
            "enum": [
              "enabled",
              "disabled"
            ],
            "default": "disabled"
          },
          "accelerationEvents": {
            "description": "Enable/disable events generated based on acceleration.<br><br> Events included: <li>deceleration <li>acceleration <li>sharpTurnLeft <li>sharpTurnRight",
            "type": "string",
            "enum": [
              "enabled",
              "disabled"
            ],
            "default": "disabled"
          },
          "gSensorEvents": {
            "description": "Enable/disable events generated based on the gSensor.<br><br> Events included: <li>jolt <li>accident <li>gsensorRegular <li>gsensorHigh",
            "type": "string",
            "enum": [
              "enabled",
              "disabled"
            ],
            "default": "disabled"
          },
          "virtualEvent": {
            "description": "Enable/disable virtual events.",
            "type": "string",
            "enum": [
              "enabled",
              "disabled"
            ],
            "default": "disabled"
          },
          "otherEvents": {
            "description": "Enable/disable other events.<br><br> Events included: <li>button <li>speedLimit <li>geoFence <li>wrongPinCode <li>qrCode <li>driverCheckIn <li>driverCheckOut <li>noCheckIn",
            "type": "string",
            "enum": [
              "enabled",
              "disabled"
            ],
            "default": "disabled"
          }
        }
      },
      "deviceConfigResponse": {
        "title": "Device configuration",
        "description": "The device configuration object for response.",
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "adas": {
            "description": "The road-facing ADAS calibration status.",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "The calibration status of the road-facing advanced driver assistance system (ADAS).",
                "type": "boolean"
              }
            }
          },
          "distractedDriver": {
            "description": "Distracted driver alerts",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "In-cabin audio and visual alerts when distracted driving events, such as cell phone usage, eating and drinking, or smoking, occur.",
                "type": "boolean"
              }
            }
          },
          "liveVideo": {
            "description": "Live video streaming",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "Live video streaming from the device.",
                "type": "boolean"
              }
            }
          },
          "driverCamera": {
            "description": "In-cab lens",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "Turn the in-cab lens (the driver-facing side of the camera) on or off. If the in-cab lens is off, all configurations related to the in-cab recording will not work; this includes distracted driver events and in-cab recording.",
                "type": "boolean"
              }
            }
          },
          "textOverlay": {
            "description": "Text overlay for recordings",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "The text overlay to appear in video recordings and events.",
                "type": "boolean"
              }
            }
          },
          "inCabinCameraRecording": {
            "description": "In-cab recording.",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "Turn the in-cabin recordings on/off. The distracted driver feature works whether or not the recordings are on.",
                "type": "boolean"
              }
            }
          },
          "driverPosition": {
            "description": "Side of driver seat",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "The side of the driver seat - the left or right side of the vehicle. Must be set correctly for the distracted driver setting to work properly.",
                "type": "string",
                "enum": [
                  "left",
                  "right"
                ]
              }
            }
          },
          "speedUnits": {
            "description": "Speed units",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "The unit used to measure speed - miles or kilometers per hour.",
                "type": "string",
                "enum": [
                  "mph",
                  "kmh"
                ]
              }
            }
          },
          "audioAlarms": {
            "description": "Audio alerts",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "Audio alerts from the device for dangerous and distracted driving events.",
                "type": "boolean"
              }
            }
          },
          "notifyLiveStreaming": {
            "description": "Live video streaming notification",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "The on-screen text notification that appears when someone is viewing live video of the device from the cloud.",
                "type": "boolean"
              }
            }
          },
          "adminPin": {
            "description": "Admin PIN",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "The PIN code used by administrators to access the device and all of its menus and options.",
                "type": "string",
                "example": "1234"
              }
            }
          },
          "driverPin": {
            "description": "Driver PIN",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "The driver PIN. This is the unique 4-digit number that any driver can use to access the recordings for a specific device.",
                "type": "string",
                "example": "4321"
              }
            }
          },
          "brightness": {
            "description": "Screen brightness",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "Set the brightness of the screen of the device, on a linear scale where 0 is dark and 255 is maximum brightness.",
                "type": "number",
                "example": 128,
                "minimum": 0,
                "maximum": 255
              }
            }
          },
          "dateTimeUnits": {
            "description": "Date and time units",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "The unit of measurement for date and time. Choose \"us\" - US units, or \"eu\" - metric units.",
                "type": "string",
                "enum": [
                  "us",
                  "eu"
                ]
              }
            }
          },
          "voiceRecording": {
            "description": "Audio recording",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "Set whether to record audio in the vehicle.",
                "type": "boolean"
              }
            }
          },
          "standby": {
            "description": "Standby",
            "type": "object",
            "required": [
              "timeout"
            ],
            "properties": {
              "timeout": {
                "description": "The amount of time, in minutes, after the vehicle stops moving, when the camera enters Standby mode. (1-60)<br> (The 1-1440 minute value range is supported on the AI-12 from firmware version 3.14 and on the AI-14 from firmware version 14.2.111.)",
                "type": "number",
                "example": 10,
                "minimum": 1,
                "maximum": 1440
              }
            }
          },
          "hotSpot": {
            "$ref": "#/components/schemas/hotSpot"
          },
          "recordingEncryption": {
            "description": "Recording encryption",
            "type": "object",
            "required": [
              "enabled"
            ],
            "properties": {
              "enabled": {
                "description": "The state of recording encryption. True is enabled, false is disabled.",
                "type": "boolean"
              }
            }
          },
          "privacy": {
            "description": "Privacy settings",
            "type": "object",
            "properties": {
              "gpsEnabled": {
                "description": "The GPS tracking.",
                "type": "boolean"
              },
              "mvaiEnabled": {
                "description": "MVAI, machine vision and artificial intelligence, to identify distracted driving.",
                "type": "boolean"
              },
              "liveStreamEnabled": {
                "description": "Allow viewing of live video streamed from the device.",
                "type": "boolean"
              },
              "allEventsEnabled": {
                "description": "Allow the device to create any event, and audio and visual alerts, as configured for this device. When set to false, no events are created, and in-cabin alerts are not triggered.",
                "type": "boolean"
              },
              "cameras": {
                "description": "The cameras array.",
                "type": "array",
                "items": {
                  "description": "The privacy settings for a specific camera object.",
                  "type": "object",
                  "required": [
                    "cameraId"
                  ],
                  "properties": {
                    "cameraId": {
                      "$ref": "#/components/schemas/cameraId"
                    },
                    "recordingEnabled": {
                      "description": "Enable or disable recording for the camera.",
                      "type": "boolean"
                    },
                    "eventsEnabled": {
                      "description": "Include or exclude media from this camera in events.",
                      "type": "boolean"
                    }
                  }
                }
              }
            }
          },
          "pinCodeDi": {
            "description": "Driver identification code",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "Enable or disable driver identification (and assignment) through a unique code specific to that driver.  Driver check-in will be implemented with the future v3.12 firmware upgrade.",
                "type": "boolean"
              }
            }
          },
          "qrDi": {
            "description": "QR code driver identification",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "Enable or disable driver identification through a QR code specific to that driver (the same as the driver code, in QR code format.  Used for driver check-in, which will be implemented with the future v3.12 firmware upgrade.",
                "type": "boolean"
              }
            }
          },
          "setTimezoneByCloud": {
            "description": "Enable or disable device retrieval of time zone information from the cloud, based on GPS location.",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "When setTimezoneByCloud is enabled, the device retrieves time zone information from the cloud, based on GPS location. When disabled, the device retrieves time zone information from the cellular provider. True is enabled, false is disabled.",
                "type": "boolean"
              }
            }
          }
        }
      },
      "devicePinCodesResponse": {
        "title": "Device PIN codes",
        "description": "The device PIN codes object for response.",
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "adminPin": {
            "description": "Admin PIN",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "The admin PIN code.",
                "type": "string",
                "example": "1234"
              }
            }
          },
          "driverPin": {
            "description": "Driver PIN",
            "type": "object",
            "required": [
              "value"
            ],
            "properties": {
              "value": {
                "description": "The driver PIN code.",
                "type": "string",
                "example": "4321"
              }
            }
          }
        }
      },
      "adasCalibrationImagesState": {
        "type": "object",
        "required": [
          "state",
          "images"
        ],
        "properties": {
          "state": {
            "type": "string",
            "description": "The availability of images for ADAS calibration.",
            "enum": [
              "available",
              "requested"
            ]
          },
          "images": {
            "type": "array",
            "description": "A list of available image URLS for ADAS calibration.",
            "items": {
              "type": "string"
            }
          }
        }
      },
      "adasCalibrationData": {
        "title": "AI-12 AND AI-14 (version < 14.4) ADAS calibration parameters",
        "description": "Device ADAS calibration parameters.",
        "type": "object",
        "additionalProperties": false,
        "allOf": [
          {
            "$ref": "#/components/schemas/commonRequestAdasFields"
          },
          {
            "type": "object",
            "required": [
              "lowestUsableRow",
              "calpickTopLeftCol",
              "calpickTopLeftRow",
              "calpickBottomLeftCol",
              "calpickBottomLeftRow",
              "calpickTopRightCol",
              "calpickTopRightRow",
              "calpickBottomRightCol",
              "calpickBottomRightRow"
            ],
            "properties": {
              "lowestUsableRow": {
                "description": "The lowest y value where the dashboard or vehicle front doesn't appear.",
                "type": "integer",
                "minimum": 0,
                "maximum": 720,
                "exclusiveMaximum": true,
                "example": 483
              },
              "calpickTopLeftCol": {
                "description": "The top left picked point x value. Should be >= calpickBottomLeftCol.",
                "type": "integer",
                "minimum": 0,
                "maximum": 1280,
                "exclusiveMaximum": true,
                "example": 533
              },
              "calpickTopLeftRow": {
                "description": "The top left picked point y value. Should be <= calpickBottomLeftRow",
                "type": "integer",
                "minimum": 0,
                "maximum": 720,
                "exclusiveMaximum": true,
                "example": 356
              },
              "calpickBottomLeftCol": {
                "description": "The bottom left picked point x value.",
                "type": "integer",
                "minimum": 0,
                "maximum": 1280,
                "exclusiveMaximum": true,
                "example": 358
              },
              "calpickBottomLeftRow": {
                "description": "The bottom left picked point y value.",
                "type": "integer",
                "minimum": 0,
                "maximum": 720,
                "exclusiveMaximum": true,
                "example": 460
              },
              "calpickTopRightCol": {
                "description": "The top right picked point x value. Should be <= calpickBottomRightCol",
                "type": "integer",
                "minimum": 0,
                "maximum": 1280,
                "exclusiveMaximum": true,
                "example": 585
              },
              "calpickTopRightRow": {
                "description": "The top right picked point y value. Should be <= calpickBottomRightRow",
                "type": "integer",
                "minimum": 0,
                "maximum": 720,
                "exclusiveMaximum": true,
                "example": 356
              },
              "calpickBottomRightCol": {
                "description": "The bottom right picked point x value.",
                "type": "integer",
                "minimum": 0,
                "maximum": 1280,
                "exclusiveMaximum": true,
                "example": 722
              },
              "calpickBottomRightRow": {
                "description": "The bottom right picked point y value.",
                "type": "integer",
                "minimum": 0,
                "maximum": 720,
                "exclusiveMaximum": true,
                "example": 458
              }
            }
          }
        ]
      },
      "reducedAdasCalibrationData": {
        "title": "AI-14(version >= 14.4) ADAS calibration parameters",
        "description": "AI-14(version >= 14.4) ADAS Calibration Data",
        "type": "object",
        "allOf": [
          {
            "$ref": "#/components/schemas/commonRequestAdasFields"
          }
        ]
      },
      "autoAdasCalibrationData": {
        "type": "object",
        "properties": {
          "subVehicleType": {
            "description": "Sub vehicle type",
            "type": "string",
            "enum": [
              "private",
              "van",
              "trailer"
            ]
          }
        }
      },
      "lastConnectedAt": {
        "title": "Device connection time",
        "description": "The last date and time that the device was connected, in ISO 8601 format.",
        "type": "string",
        "format": "date-time"
      },
      "deviceHealth": {
        "type": "object",
        "title": "Device health",
        "description": "The device health status object.",
        "required": [
          "imei",
          "name",
          "organizationId",
          "partnerId",
          "lastConnectedAt",
          "lastRecordingHealth",
          "lastRecordingUpdatedAt",
          "alarms",
          "auxNum",
          "calibrationCompleted",
          "auxiliaryCameras"
        ],
        "properties": {
          "name": {
            "$ref": "#/components/schemas/deviceName"
          },
          "imei": {
            "$ref": "#/components/schemas/imei"
          },
          "organizationId": {
            "$ref": "#/components/schemas/organizationId"
          },
          "partnerId": {
            "$ref": "#/components/schemas/partnerId"
          },
          "lastConnectedAt": {
            "$ref": "#/components/schemas/lastConnectedAt"
          },
          "lastRecordingHealth": {
            "$ref": "#/components/schemas/lastRecordingHealth"
          },
          "lastRecordingUpdatedAt": {
            "$ref": "#/components/schemas/lastRecordingUpdatedAt"
          },
          "alarms": {
            "$ref": "#/components/schemas/deviceHealthAlarms"
          },
          "auxNum": {
            "$ref": "#/components/schemas/auxiliaryCamerasCount"
          },
          "calibrationCompleted": {
            "$ref": "#/components/schemas/calibrationCompleted"
          },
          "auxiliaryCameras": {
            "title": "Auxiliary Cameras",
            "description": "Auxiliary cameras connected to the device",
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/deviceHealthAuxiliaryCamera"
            }
          }
        }
      },
      "deviceDataUsageResponseObject": {
        "type": "object",
        "title": "Device data usage",
        "description": "The device data usage report object.",
        "required": [
          "imei",
          "name",
          "firmwareVersion",
          "notificaitonEnabled",
          "thresholdSet",
          "dataUsageMegabytes",
          "videoEventsMegabytes",
          "liveVideoMegabytes",
          "recordingUploadedMegabytes",
          "recordStreamingMegabytes",
          "billingDate"
        ],
        "properties": {
          "name": {
            "$ref": "#/components/schemas/deviceName"
          },
          "imei": {
            "$ref": "#/components/schemas/imei"
          },
          "firmwareVersion": {
            "$ref": "#/components/schemas/firmwareVersion"
          },
          "notificaitonEnabled": {
            "$ref": "#/components/schemas/notificaitonEnabled"
          },
          "thresholdSet": {
            "$ref": "#/components/schemas/thresholdSet"
          },
          "dataUsageMegabytes": {
            "$ref": "#/components/schemas/dataUsageMegabytes"
          },
          "videoEventsMegabytes": {
            "$ref": "#/components/schemas/videoEventsMegabytes"
          },
          "liveVideoMegabytes": {
            "$ref": "#/components/schemas/liveVideoMegabytes"
          },
          "recordingUploadedMegabytes": {
            "$ref": "#/components/schemas/recordingUploadedMegabytes"
          },
          "recordStreamingMegabytes": {
            "$ref": "#/components/schemas/recordStreamingMegabytes"
          },
          "billingDate": {
            "$ref": "#/components/schemas/billingDate"
          }
        }
      },
      "healthReportIntervalSeconds": {
        "title": "Device health report interval",
        "description": "The frequency of the device health report, in seconds. To receive a report email every hour, the value should be 3600.",
        "type": "number",
        "example": 3600
      },
      "deviceModel": {
        "title": "Device model",
        "description": "The model of the device.",
        "type": "string",
        "example": "AI-12"
      },
      "deviceName": {
        "type": "string",
        "title": "Device name",
        "description": "The name assigned to the device in the POST /organizations/{orgId}/devices call.",
        "example": "Aragorn's car"
      },
      "dataProfileId": {
        "type": "number",
        "title": "Device data profile ID",
        "description": "The ID of the data profile",
        "example": 123
      },
      "dataProfileIdString": {
        "type": "string",
        "title": "Device data profile ID",
        "description": "The ID of the data profile",
        "pattern": "^[1-9]\\d*$",
        "example": "25"
      },
      "billingStatusString": {
        "title": "Billing Status",
        "description": "The billing status of the device",
        "type": "string",
        "enum": [
          "pendingActivation",
          "deactivated",
          "suspended"
        ]
      },
      "getBillingStatusString": {
        "title": "Billing Status",
        "description": "The billing status of the device",
        "type": "string",
        "enum": [
          "pendingActivation",
          "deactivated",
          "suspended",
          "activated"
        ],
        "example": "suspended"
      },
      "getAuxBillingStatusString": {
        "title": "Billing Status",
        "description": "The billing status of auxiliary camera devices",
        "type": "string",
        "default": "disable",
        "enum": [
          "enable",
          "disable"
        ],
        "example": "disable"
      },
      "lastRecordingHealth": {
        "title": "Device recording health",
        "description": "The health status of the device during the last recording.",
        "type": "boolean"
      },
      "lastRecordingUpdatedAt": {
        "title": "Device recording time",
        "description": "The last date and time that the device recordings were updated, in ISO 8601 format.",
        "type": "string",
        "format": "date-time"
      },
      "deviceHealthAlarms": {
        "title": "Device alarms",
        "description": "The alarms associated with the device.",
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "code",
            "details"
          ],
          "properties": {
            "code": {
              "type": "string",
              "description": "The code of the alarm.",
              "example": "133"
            },
            "details": {
              "type": "string",
              "description": "The details of the alarm.",
              "example": "SD Card is not mounted, the dashcam is not recording video"
            }
          }
        }
      },
      "deviceTelemetry": {
        "title": "Device telemetry",
        "description": "The device telemetry object.",
        "type": "object",
        "required": [
          "firmwareVersion",
          "deviceModel",
          "lastSeenOnline",
          "simNetworkType",
          "simOperator",
          "simState",
          "calibrationCompleted",
          "sdCardInserted",
          "sdCardCapacityBytes",
          "sdCardFreeBytes"
        ],
        "properties": {
          "firmwareVersion": {
            "$ref": "#/components/schemas/firmwareVersion"
          },
          "modemVersion": {
            "$ref": "#/components/schemas/modemVersion"
          },
          "deviceModel": {
            "$ref": "#/components/schemas/deviceModel"
          },
          "lastSeenOnline": {
            "$ref": "#/components/schemas/lastSeenOnline"
          },
          "simNetworkType": {
            "$ref": "#/components/schemas/simNetworkType"
          },
          "simOperator": {
            "$ref": "#/components/schemas/simOperator"
          },
          "simState": {
            "$ref": "#/components/schemas/simState"
          },
          "simNumber": {
            "$ref": "#/components/schemas/simNumber"
          },
          "calibrationCompleted": {
            "$ref": "#/components/schemas/calibrationCompleted"
          },
          "sdCardInserted": {
            "$ref": "#/components/schemas/sdCardInserted"
          },
          "sdCardCapacityBytes": {
            "$ref": "#/components/schemas/sdCardCapacityBytes"
          },
          "sdCardFreeBytes": {
            "$ref": "#/components/schemas/sdCardFreeBytes"
          },
          "adasCalibrationReady": {
            "$ref": "#/components/schemas/adasCalibrationReady"
          },
          "adasCalibrationCompleted": {
            "$ref": "#/components/schemas/adasCalibrationCompleted"
          },
          "wifiEnabled": {
            "$ref": "#/components/schemas/wifiEnabled"
          },
          "wifiConnected": {
            "$ref": "#/components/schemas/wifiConnected"
          },
          "wifiSignalLevel": {
            "$ref": "#/components/schemas/wifiSignalLevel"
          },
          "auxCameras": {
            "$ref": "#/components/schemas/auxCameras"
          }
        }
      },
      "email": {
        "title": "Email",
        "description": "The email address of the entity.",
        "type": "string",
        "format": "email",
        "pattern": "^\\S+@\\S+\\.\\S{2,}$",
        "example": "email@email.com"
      },
      "recipientId": {
        "title": "Email recipient ID",
        "description": "The ID of the email recipient.",
        "type": "number",
        "example": 23
      },
      "end": {
        "title": "End date and time",
        "description": "The end date and time, in ISO 8601 format.",
        "type": "string",
        "format": "date-time",
        "example": "2020-01-01T14:48:00.000Z"
      },
      "entity": {
        "title": "Entity type",
        "description": "The current authenticated entity type.",
        "type": "string",
        "enum": [
          "partner",
          "user"
        ]
      },
      "error": {
        "title": "Error",
        "description": "The error and its message object.",
        "type": "object",
        "required": [
          "error",
          "message"
        ],
        "properties": {
          "error": {
            "type": "string",
            "description": "The error name."
          },
          "message": {
            "type": "string",
            "description": "The error message."
          }
        }
      },
      "recipientNotificationObject": {
        "type": "object",
        "title": "‘Device Notification Recipients",
        "description": "The list of recipients for email notifications of an event.",
        "required": [
          "recipient",
          "eventType",
          "status"
        ],
        "properties": {
          "recipient": {
            "$ref": "#/components/schemas/email"
          },
          "eventType": {
            "$ref": "#/components/schemas/eventType"
          },
          "status": {
            "$ref": "#/components/schemas/recipientNotificationStatus"
          }
        }
      },
      "recipientNotificationStatus": {
        "title": "Device Event Notification Status",
        "description": "The status of the email notification for the recipient, whether enabled or not.",
        "type": "integer",
        "enum": [
          0,
          1
        ]
      },
      "event": {
        "title": "Event",
        "description": "The event object.",
        "type": "object",
        "required": [
          "id",
          "eventType",
          "time",
          "lat",
          "lon",
          "files"
        ],
        "properties": {
          "id": {
            "$ref": "#/components/schemas/eventId"
          },
          "eventType": {
            "$ref": "#/components/schemas/eventType"
          },
          "imei": {
            "$ref": "#/components/schemas/imei"
          },
          "time": {
            "$ref": "#/components/schemas/time"
          },
          "lat": {
            "$ref": "#/components/schemas/latitude"
          },
          "lon": {
            "$ref": "#/components/schemas/longitude"
          },
          "uniqueness": {
            "$ref": "#/components/schemas/uniqueness"
          },
          "speed": {
            "$ref": "#/components/schemas/speedKmh"
          },
          "accuracy": {
            "$ref": "#/components/schemas/accuracy"
          },
          "status": {
            "$ref": "#/components/schemas/eventStatus"
          },
          "severity": {
            "$ref": "#/components/schemas/eventSeverity"
          },
          "eventComments": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/eventCommentObject"
            }
          },
          "files": {
            "description": "The files attached to the event array.",
            "type": "array",
            "items": {
              "description": "The file attached to the event object.",
              "type": "object",
              "required": [
                "cameraId",
                "fileType",
                "fileId",
                "mediaAvailable"
              ],
              "properties": {
                "cameraId": {
                  "$ref": "#/components/schemas/cameraId"
                },
                "fileType": {
                  "$ref": "#/components/schemas/fileType"
                },
                "fileId": {
                  "$ref": "#/components/schemas/fileId"
                },
                "mediaAvailable": {
                  "$ref": "#/components/schemas/mediaAvailable"
                }
              }
            }
          },
          "geoFenceId": {
            "$ref": "#/components/schemas/geofenceId"
          },
          "metadata": {
            "$ref": "#/components/schemas/eventMetadata"
          }
        }
      },
      "eventId": {
        "title": "Event ID",
        "description": "The ID assigned to the event.",
        "type": "integer",
        "example": 3
      },
      "eventMetadata": {
        "title": "Event metadata",
        "description": "The metadata of the event.",
        "type": "string",
        "example": "{type:'Test event', scope:'Some test scope'}"
      },
      "eventStatus": {
        "description": "The review status of the event.",
        "type": "string",
        "enum": [
          "new",
          "resolved"
        ]
      },
      "eventSeverity": {
        "description": "The severity of the event.\n* 1 - high\n* 2 - medium\n* 3 - low\n",
        "type": "number",
        "enum": [
          1,
          2,
          3
        ]
      },
      "eventCommentText": {
        "title": "Event comment",
        "description": "The comment added to the event.",
        "type": "string",
        "pattern": "^(.|[\\n]){1,255}$"
      },
      "eventCommentObject": {
        "title": "Event comment object",
        "description": "The event comment object.",
        "type": "object",
        "properties": {
          "id": {
            "title": "Event comment ID",
            "description": "The ID of the event comment.",
            "type": "integer",
            "example": 125
          },
          "comment": {
            "$ref": "#/components/schemas/eventCommentText"
          },
          "createdByAudienceName": {
            "$ref": "#/components/schemas/audienceName"
          },
          "createdById": {
            "type": "integer",
            "description": "The ID of the user who created the event comment.",
            "example": 625
          },
          "createdBy": {
            "title": "User data of commenter",
            "description": "The user data of the user who created the event comment.",
            "type": "object",
            "properties": {
              "id": {
                "oneOf": [
                  {
                    "$ref": "#/components/schemas/userId"
                  },
                  {
                    "$ref": "#/components/schemas/partnerId"
                  }
                ]
              },
              "email": {
                "$ref": "#/components/schemas/email"
              }
            }
          },
          "createdAt": {
            "description": "The date that the event comment was created, in ISO format.",
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "eventSettingObject": {
        "type": "object",
        "title": "Event settings",
        "description": "The settings configuration of a single event object.<br><br> The dataType field is required for all events. The lat, lon, and radius fields are required when eventType is set to geoFence.",
        "required": [
          "eventType",
          "dataType"
        ],
        "properties": {
          "eventType": {
            "$ref": "#/components/schemas/modifiableEvents"
          },
          "dataType": {
            "$ref": "#/components/schemas/dataType"
          },
          "weight": {
            "$ref": "#/components/schemas/weight"
          },
          "speedLimit": {
            "$ref": "#/components/schemas/speedLimit"
          },
          "numberOfBeeps": {
            "$ref": "#/components/schemas/numberOfBeepsBeforeEvent"
          },
          "minimumSpeed": {
            "$ref": "#/components/schemas/minimumSpeedToCreateEvent"
          },
          "config": {
            "type": "object",
            "properties": {
              "headwayAlertDayThreshold": {
                "$ref": "#/components/schemas/headwayAlertDayThreshold"
              },
              "headwayAlertNightThreshold": {
                "$ref": "#/components/schemas/headwayAlertNightThreshold"
              },
              "headwayAlertTime": {
                "$ref": "#/components/schemas/headwayAlertTime"
              },
              "timeWindow": {
                "$ref": "#/components/schemas/timeWindow"
              },
              "numberOfYawns": {
                "$ref": "#/components/schemas/numberOfYawns"
              },
              "assumeMoving": {
                "$ref": "#/components/schemas/assumeMoving"
              },
              "laneWeavingTimes": {
                "$ref": "#/components/schemas/laneWeavingTimes"
              },
              "laneWeavingDurationSeconds": {
                "$ref": "#/components/schemas/laneWeavingDurationSeconds"
              }
            }
          },
          "drivingDuration": {
            "$ref": "#/components/schemas/drivingDuration"
          },
          "visualAlert": {
            "$ref": "#/components/schemas/visualAlert"
          },
          "audioAlert": {
            "$ref": "#/components/schemas/audioAlert"
          }
        }
      },
      "patchEventConfig": {
        "title": "Events configuration",
        "description": "The event settings configuration of the device object.",
        "type": "object",
        "required": [
          "events"
        ],
        "properties": {
          "vehicleType": {
            "$ref": "#/components/schemas/vehicleType"
          },
          "events": {
            "type": "array",
            "description": "The events array.",
            "items": {
              "$ref": "#/components/schemas/eventSettingObject"
            }
          }
        }
      },
      "eventConfig": {
        "title": "Events configuration",
        "description": "The events settings configuration of the device object.",
        "type": "object",
        "required": [
          "vehicleType",
          "events"
        ],
        "properties": {
          "vehicleType": {
            "$ref": "#/components/schemas/vehicleType"
          },
          "events": {
            "type": "array",
            "description": "The events array.",
            "items": {
              "$ref": "#/components/schemas/eventSettingObject"
            }
          }
        }
      },
      "systemMessagesWebhookObject": {
        "title": "System messages webhook configuration",
        "description": "The system messages webhook configuration of organization object.",
        "type": "object",
        "properties": {
          "url": {
            "type": "string",
            "minLength": 5
          },
          "config": {
            "type": "object",
            "properties": {
              "dataProfile": {
                "$ref": "#/components/schemas/dataProfileObject"
              },
              "deviceStatus": {
                "$ref": "#/components/schemas/deviceStatusObject"
              },
              "deviceBillingStatus": {
                "$ref": "#/components/schemas/deviceBillingStatusObject"
              },
              "deviceRemoved": {
                "$ref": "#/components/schemas/deviceRemovedObject"
              },
              "auxiliaryCamerasConnectionStatus": {
                "$ref": "#/components/schemas/auxiliaryCamerasConnectionStatusObject"
              },
              "auxiliaryCamerasPairingStatus": {
                "$ref": "#/components/schemas/deviceAuxiliaryCamerasPairingStatusObject"
              },
              "privacyMode": {
                "$ref": "#/components/schemas/privacyModeObject"
              },
              "dataUsage": {
                "$ref": "#/components/schemas/dataUsageObject"
              },
              "dynamicAdjust": {
                "$ref": "#/components/schemas/dynamicAdjustObject"
              }
            }
          }
        }
      },
      "deviceStatusObject": {
        "title": "Device status change webhook configuration",
        "description": "The system messages webhook settings for device status change of the device object.<br>NOTE: On AI-14 devices, a status change between ONLINE and STANDBY results in a temporary OFFLINE state, and a webhook is sent for this transition as well.",
        "type": "object",
        "properties": {
          "isEnabled": {
            "type": "boolean",
            "default": false
          }
        }
      },
      "deviceBillingStatusObject": {
        "title": "Device billing status change webhook configuration",
        "description": "The system messages webhook settings for device billing status change of the device object.",
        "type": "object",
        "properties": {
          "isEnabled": {
            "type": "boolean",
            "default": false
          }
        }
      },
      "deviceAuxiliaryCamerasPairingStatusObject": {
        "title": "Device auxiliary cameras pairing update webhook configuration",
        "description": "The system messages webhook settings for device auxiliary camera search, pair, and unpair requests.",
        "type": "object",
        "properties": {
          "isEnabled": {
            "type": "boolean",
            "default": false
          }
        }
      },
      "dataProfileObject": {
        "title": "Data profile cap reached webhook configuration",
        "description": "The system messages webhook settings for device data profile cap reached of the device object.",
        "type": "object",
        "properties": {
          "isEnabled": {
            "type": "boolean",
            "default": false
          },
          "dataProfileLimit": {
            "type": "integer",
            "minimum": 10,
            "maximum": 100,
            "default": 90
          }
        }
      },
      "privacyModeObject": {
        "title": "Privacy mode status update",
        "description": "The system message webhook settings for configuration changes while in private mode when the device was offline and for device privacy mode status change: General or Disabled.",
        "type": "object",
        "properties": {
          "isEnabled": {
            "type": "boolean",
            "default": false
          }
        }
      },
      "dynamicAdjustObject": {
        "title": "Device configuration dynamic adjust webhook configuration",
        "description": "NOTE: AI-14 devices only. Contact your TAM for enablement instructions. This Webhook automates regulatory compliance via the Illinois Geofence. If a vehicle enters or activates within Illinois without explicit user consent, onboard MV+AI functions are automatically disabled. The system restores these functions once the vehicle exits the Geofence. Continuous status updates are provided for entry, compliance, and exit stages to maintain full system visibility.",
        "type": "object",
        "properties": {
          "isEnabled": {
            "type": "boolean",
            "default": false
          }
        }
      },
      "dataUsageObject": {
        "type": "object",
        "title": "Data usage threshold webhook configuration",
        "description": "The system messages webhook settings for device data usage threshold notifications allow you to trigger a webhook notification when a device's data usage surpasses its configured dataPlan or any of up to 20 specified dataThresholds (in gigabytes). These thresholds enable proactive monitoring and <b> notification </b> of data consumption. Each threshold value must be between 0.1 GB and 20 GB. If neither dataPlan nor dataThresholds is provided, a default threshold of 1 GB is applied.",
        "properties": {
          "isEnabled": {
            "type": "boolean",
            "default": false
          },
          "dataThresholds": {
            "type": "array",
            "minItems": 1,
            "maxItems": 20,
            "default": [
              1
            ],
            "uniqueItems": true,
            "description": "The dataThresholds field is an array of up to 20 custom threshold values (in gigabytes). A webhook notification is triggered each time the device's data usage surpasses one of the defined thresholds. This allows for staged or progressive alerts as usage increases. Each threshold must be between 0.1 GB and 20 GB. In cases where the data plan is extended via a top-up or additional data pack, threshold values may exceed the original dataPlan limit. Each value is rounded up to two decimal places.",
            "items": {
              "type": "number",
              "minimum": 0.1,
              "maximum": 20
            }
          },
          "dataPlan": {
            "type": "number",
            "description": "The dataPlan field specifies the total data allowance (in gigabytes) for a device. A webhook notification is triggered when the device's cumulative data usage reaches or exceeds this limit. This is useful for tracking <b> the entire consumption </b> of a data plan. The maximum allowed value for dataPlan is 20 GB. The value is <b> rounded up </b> to two decimal places.",
            "maximum": 20,
            "minimum": 0.1
          }
        },
        "example": {
          "isEnabled": true,
          "dataThresholds": [
            0.5,
            1.5
          ],
          "dataPlan": 1
        }
      },
      "deviceRemovedObject": {
        "title": "Device removed from inventory",
        "description": "The system messages webhook setting to enable a notification when a device is removed from inventory.",
        "type": "object",
        "properties": {
          "isEnabled": {
            "type": "boolean",
            "default": false
          }
        }
      },
      "auxiliaryCamerasConnectionStatusObject": {
        "title": "Auxiliary Cameras connection status",
        "description": "The system message webhook setting to enable a notification when an auxiliary camera is connected to, or disconnected from, a device.",
        "type": "object",
        "properties": {
          "isEnabled": {
            "type": "boolean",
            "default": false
          }
        }
      },
      "notifyMediaAvailableObject": {
        "title": "Allow mediaAvailable parameter in event webhooks and receive webhooks for each media file uploaded.",
        "description": "Enable additional event webhooks for same event, \\\nfor notifications when the event media becomes available, \\\nif there are media files associated with the event and available in the cloud. \\\nWhen enabled, this setting applies to all event webhook urls.\n",
        "type": "object",
        "properties": {
          "isEnabled": {
            "type": "boolean",
            "default": true
          }
        }
      },
      "subscribeForAlarmUpdatesObject": {
        "title": "Receive alarms webhooks when alarms are closed, not just for alarm creation.",
        "description": "When enabled, the alarms webhook is received both when an alarm is created and closed. \\\nBy default alarms webhooks are received when alarms are created only.\n",
        "type": "object",
        "properties": {
          "isEnabled": {
            "type": "boolean",
            "default": false
          }
        }
      },
      "webhookConfig": {
        "title": "Webhook configuration",
        "description": "The webhook settings configuration of the device object.",
        "type": "object",
        "properties": {
          "gpsWebhookUrl": {
            "$ref": "#/components/schemas/gpsWebhookUrl"
          },
          "eventWebhookUrl": {
            "$ref": "#/components/schemas/eventWebhookUrl"
          },
          "eventWebhookConfig": {
            "$ref": "#/components/schemas/eventWebhookConfig"
          },
          "alarmsWebhookUrl": {
            "$ref": "#/components/schemas/alarmsWebhookUrl"
          },
          "alarmsWebhookConfig": {
            "$ref": "#/components/schemas/alarmsWebhookConfig"
          },
          "systemMessagesWebhook": {
            "$ref": "#/components/schemas/systemMessagesWebhook"
          }
        }
      },
      "mediaAvailable": {
        "title": "Media available",
        "description": "True if file has uploaded to S3",
        "type": "boolean"
      },
      "gpsWebhookUrl": {
        "type": "array",
        "description": "The destination URLs for GPS webhooks.",
        "maxItems": 3,
        "items": {
          "type": "string",
          "minLength": 5
        }
      },
      "eventWebhookUrl": {
        "type": "array",
        "description": "The destination URLs for event webhooks.",
        "maxItems": 3,
        "items": {
          "type": "string",
          "minLength": 5
        }
      },
      "eventWebhookConfig": {
        "title": "Events webhook configuration",
        "description": "The events webhook configuration of organization object.",
        "type": "object",
        "properties": {
          "notifyMediaAvailable": {
            "$ref": "#/components/schemas/notifyMediaAvailableObject"
          }
        }
      },
      "alarmsWebhookUrl": {
        "type": "array",
        "description": "The destination URLs for alarms webhooks.",
        "maxItems": 3,
        "items": {
          "type": "string",
          "minLength": 5
        }
      },
      "alarmsWebhookConfig": {
        "title": "Alarms webhook configuration",
        "description": "The alarms webhook configuration of organization object.",
        "type": "object",
        "properties": {
          "subscribeForAlarmUpdates": {
            "$ref": "#/components/schemas/subscribeForAlarmUpdatesObject"
          }
        }
      },
      "systemMessagesWebhook": {
        "type": "array",
        "description": "The destination URLs and their configuration for system messages webhooks.",
        "maxItems": 3,
        "items": {
          "$ref": "#/components/schemas/systemMessagesWebhookObject"
        }
      },
      "fileId": {
        "title": "File ID",
        "description": "The ID of the file.",
        "type": "string",
        "example": "1595077872"
      },
      "fileType": {
        "title": "File type",
        "description": "The file type.",
        "type": "string",
        "enum": [
          "video",
          "snapshot"
        ]
      },
      "fileUrl": {
        "type": "string",
        "description": "The URL from which to download the requested file.",
        "example": "https://sample.s3.aws.com/123/123.mp4?access_key=1234"
      },
      "firmwareVersion": {
        "title": "Firmware version",
        "description": "The firmware version of the device.",
        "type": "string",
        "example": "3.9.53"
      },
      "modemVersion": {
        "title": "Modem version",
        "description": "The modem version of the device.",
        "type": "string",
        "example": "EG95EXGAR08A08M1G_230626_20.201.20.201"
      },
      "geofence": {
        "title": "Geofence",
        "description": "The geofence event settings configuration object.",
        "type": "object",
        "required": [
          "lat",
          "lon",
          "radius",
          "name",
          "id"
        ],
        "properties": {
          "lat": {
            "$ref": "#/components/schemas/latitude"
          },
          "lon": {
            "$ref": "#/components/schemas/longitude"
          },
          "radius": {
            "description": "The radius of the geofence, in meters.",
            "type": "number",
            "example": 200
          },
          "name": {
            "description": "The name assigned to the geofence in the PUT /devices/{imei}/geofences call.",
            "type": "string",
            "example": "My geofence 1"
          },
          "id": {
            "$ref": "#/components/schemas/geofenceId"
          }
        }
      },
      "geofenceId": {
        "title": "Geofence ID",
        "description": "The ID of the relevant geoFence. Only applies when the event type is geoFence.",
        "type": "number",
        "example": 3
      },
      "accuracy": {
        "title": "GPS accuracy",
        "description": "The accuracy of the GPS in meters",
        "type": "number",
        "example": 4
      },
      "gpsPoint": {
        "type": "object",
        "title": "GPS",
        "description": "The GPS object.",
        "required": [
          "lat",
          "lon",
          "alt",
          "time",
          "speed"
        ],
        "properties": {
          "accuracy": {
            "$ref": "#/components/schemas/accuracy"
          },
          "lat": {
            "$ref": "#/components/schemas/latitude"
          },
          "lon": {
            "$ref": "#/components/schemas/longitude"
          },
          "alt": {
            "$ref": "#/components/schemas/altitude"
          },
          "time": {
            "type": "number",
            "description": "The time, in seconds from epoch.",
            "example": 1595077872
          },
          "speed": {
            "$ref": "#/components/schemas/speedMps"
          },
          "postedSpeed": {
            "$ref": "#/components/schemas/postedSpeed"
          },
          "postedSpeedHgv": {
            "$ref": "#/components/schemas/postedSpeedHgv"
          },
          "postedSpeedTrailer": {
            "$ref": "#/components/schemas/postedSpeedTrailer"
          }
        }
      },
      "gpsPointTrip": {
        "type": "object",
        "title": "GPS",
        "description": "The GPS object.",
        "required": [
          "lat",
          "lon",
          "time",
          "speed"
        ],
        "properties": {
          "accuracy": {
            "$ref": "#/components/schemas/accuracy"
          },
          "lat": {
            "$ref": "#/components/schemas/latitude"
          },
          "lon": {
            "$ref": "#/components/schemas/longitude"
          },
          "alt": {
            "$ref": "#/components/schemas/altitudeOptional"
          },
          "time": {
            "type": "number",
            "description": "The time, in seconds from epoch.",
            "example": 1595077872
          },
          "speed": {
            "$ref": "#/components/schemas/speedMps"
          }
        }
      },
      "group": {
        "type": "object",
        "title": "Group",
        "description": "The group object. Groups can contain zero or more devices.",
        "required": [
          "name",
          "id"
        ],
        "properties": {
          "name": {
            "type": "string",
            "description": "The name assigned to the group in the POST /organizations/{orgId}/groups call.",
            "example": "Mordor group"
          },
          "id": {
            "type": "number",
            "description": "The ID of the group.",
            "example": 461
          }
        }
      },
      "groupId": {
        "type": "integer",
        "minimum": -1,
        "title": "Group ID",
        "description": "The ID of the group. Obtain this from GET /organizations/{orgId}/devices. If a groupId is not specified or = -1, the device will be added without being assigned to any group.",
        "example": 32
      },
      "healthRecipient": {
        "type": "object",
        "title": "Health report email recipient",
        "description": "The health report email recipient object.",
        "required": [
          "email",
          "reportIntervalSeconds"
        ],
        "properties": {
          "email": {
            "$ref": "#/components/schemas/email"
          },
          "reportIntervalSeconds": {
            "$ref": "#/components/schemas/healthReportIntervalSeconds"
          },
          "organizationId": {
            "$ref": "#/components/schemas/organizationId"
          }
        }
      },
      "extendedHealthRecipient": {
        "title": "Health report email recipient - extended",
        "description": "The extended hea;th report email recipient object",
        "allOf": [
          {
            "$ref": "#/components/schemas/healthRecipient"
          },
          {
            "type": "object",
            "required": [
              "id"
            ],
            "properties": {
              "id": {
                "$ref": "#/components/schemas/recipientId"
              }
            }
          }
        ]
      },
      "imei": {
        "title": "IMEI",
        "description": "The IMEI number of the device. The IMEI number can be found on a sticker on the device itself or on the back of the device box.",
        "type": "string",
        "example": "357660101000198"
      },
      "lastSeenOnline": {
        "title": "Last seen online",
        "description": "The most recent time that the device connected to the cloud, in ISO 8601 format. Updated every fifteen seconds.",
        "type": "string",
        "format": "date-time",
        "example": "2020-01-01T14:48:00.000Z"
      },
      "latitude": {
        "title": "Latitude",
        "description": "The GPS latitude.",
        "type": "number",
        "minimum": -90,
        "maximum": 90,
        "example": 32.0598671
      },
      "longitude": {
        "title": "Longitude",
        "description": "The GPS longitude.",
        "type": "number",
        "minimum": -180,
        "maximum": 180,
        "example": 34.7827316
      },
      "uniqueness": {
        "title": "Uniqueness",
        "description": "The unique id representing the device event with timestamp.",
        "type": "string",
        "example": "357660102858164_button_1697358575"
      },
      "connectMedia": {
        "title": "Media core server connection",
        "description": "The connect to a media core server object.",
        "type": "object",
        "required": [
          "data"
        ],
        "properties": {
          "data": {
            "description": "The connect to media core server to prepare the device for streaming and downloading object. The media token is valid for thirty minutes.",
            "type": "object",
            "required": [
              "address",
              "mediaToken"
            ],
            "properties": {
              "address": {
                "type": "string",
                "description": "Receive the URL to get a recording or live video. Make this call again if your device does not start\nstreaming within two minutes.<br><br>\nTo manage bandwidth, audio does not play when streaming. To receive audio, download the recording.\n",
                "example": "prod-us-03.surfsight.net"
              },
              "mediaToken": {
                "type": "string",
                "description": "The authentication token required for the URL that is generated. Valid for thirty minutes.",
                "example": "e3d53477-1f85-42c1-8ed0-2bb591700db8"
              }
            }
          }
        }
      },
      "imageRecords": {
        "type": "object",
        "required": [
          "id",
          "url",
          "status"
        ],
        "properties": {
          "id": {
            "type": "string",
            "description": "A unique identifier for the image."
          },
          "url": {
            "type": "string",
            "format": "uri",
            "description": "The URI location of the image."
          },
          "status": {
            "type": "string",
            "description": "Driver Recognition Status.<br> - Familiar: The driver is recognized and authorized to drive fleet vehicles.<br> - Unfamiliar: The driver is not recognized or is unauthorized to drive fleet vehicles.<br> - Pending Review: The system is currently processing the image for identification.",
            "enum": [
              "familiar",
              "unfamiliar",
              "pendingReview"
            ]
          }
        }
      },
      "metadataImageRecords": {
        "title": "Metadata for album images",
        "type": "object",
        "required": [
          "imageStatusCount",
          "pagination"
        ],
        "properties": {
          "imageStatusCount": {
            "description": "Total Image Count Listed by Review Status (Familiar, Unfamiliar, Pending Review)",
            "$ref": "#/components/schemas/imageStatusCount",
            "example": 56
          },
          "pagination": {
            "$ref": "#/components/schemas/metadata"
          }
        }
      },
      "imageStatusCount": {
        "title": "Total Images in Album",
        "type": "object",
        "required": [
          "pendingReview",
          "familiar",
          "unfamiliar"
        ],
        "properties": {
          "pendingReview": {
            "description": "The Total Number of Images Pending Review.",
            "type": "integer",
            "example": 12
          },
          "familiar": {
            "description": "The Total Images Classified as Familiar.",
            "type": "integer",
            "example": 30
          },
          "unfamiliar": {
            "description": "The Total Images Classified as Unfamiliar.",
            "type": "integer",
            "example": 14
          }
        }
      },
      "metadata": {
        "title": "Pagination metadata",
        "description": "The pagination metadata object.",
        "type": "object",
        "required": [
          "count",
          "limit",
          "offset"
        ],
        "properties": {
          "count": {
            "description": "The total number of results generated by the call.",
            "type": "integer",
            "example": 56
          },
          "limit": {
            "description": "The maximum number of pagination results to receive.",
            "type": "integer",
            "example": 60
          },
          "offset": {
            "description": "The number of results to skip over before receiving pagination results.",
            "type": "integer",
            "example": 10
          }
        }
      },
      "simOperator": {
        "title": "Mobile operator",
        "description": "The mobile operator of the device SIM card.",
        "type": "string",
        "example": "Cellcom IL"
      },
      "monthlyAggregateResult": {
        "title": "Monthly results",
        "description": "The overall result of the previous months for the entity.",
        "required": [
          "monthsAgo",
          "startTime",
          "endTime",
          "count"
        ],
        "properties": {
          "monthsAgo": {
            "description": "The number of previous months included in the statistical trends.",
            "type": "integer",
            "minimum": 0,
            "example": 2
          },
          "startTime": {
            "description": "The start time of the previous months, in ISO format.",
            "type": "string",
            "format": "date-time"
          },
          "endTime": {
            "description": "The end time of the previous months, in ISO format.",
            "type": "string",
            "format": "date-time"
          },
          "count": {
            "description": "The total number of results for the previous months.",
            "type": "integer",
            "minimum": 0,
            "example": 1
          }
        }
      },
      "groupToCreate": {
        "type": "object",
        "title": "New group",
        "description": "The new group object.",
        "required": [
          "name"
        ],
        "properties": {
          "name": {
            "$ref": "#/components/schemas/groupName"
          }
        }
      },
      "groupToUpdate": {
        "type": "object",
        "title": "Group to update",
        "description": "Object with groupId and fields to update",
        "required": [
          "groupId"
        ],
        "properties": {
          "groupId": {
            "type": "number",
            "description": "The id of the group to update.",
            "example": 1,
            "minimum": 1
          },
          "name": {
            "$ref": "#/components/schemas/groupName"
          }
        }
      },
      "groupToDelete": {
        "type": "object",
        "title": "Group to delete",
        "description": "Object with groupId to delete",
        "required": [
          "groupId"
        ],
        "properties": {
          "groupId": {
            "type": "number",
            "description": "The id of the group to delete.",
            "example": 1,
            "minimum": 1
          }
        }
      },
      "organization": {
        "type": "object",
        "title": "Organization",
        "description": "The organization object.",
        "required": [
          "name"
        ],
        "properties": {
          "name": {
            "type": "string",
            "minLength": 1,
            "description": "The name of the organization. Obtain this from GET /organizations.",
            "example": "Amazing organization"
          },
          "purgeDays": {
            "$ref": "#/components/schemas/organizationPurgeDays"
          },
          "purgeDaysFrontCamera": {
            "$ref": "#/components/schemas/organizationPurgeDays"
          },
          "purgeDaysRearCamera": {
            "$ref": "#/components/schemas/organizationPurgeDays"
          },
          "purgeDaysAuxiliaryCameras": {
            "$ref": "#/components/schemas/organizationPurgeDays"
          },
          "exclusivePartnerOnly": {
            "$ref": "#/components/schemas/organizationExclusivePartnerOnly"
          },
          "isOrganizationProfileEnabled": {
            "$ref": "#/components/schemas/isOrganizationProfileEnabled"
          }
        }
      },
      "extendedOrganization": {
        "title": "Organization - extended",
        "description": "The extended organization object.",
        "allOf": [
          {
            "$ref": "#/components/schemas/organization"
          },
          {
            "type": "object",
            "required": [
              "id",
              "alarmsCount",
              "partnerId"
            ],
            "properties": {
              "id": {
                "$ref": "#/components/schemas/organizationId"
              },
              "partnerId": {
                "$ref": "#/components/schemas/partnerId"
              },
              "alarmsCount": {
                "type": "number",
                "description": "The number of unread alarms.",
                "example": 7
              },
              "liveVideoTimeoutSeconds": {
                "type": "number",
                "description": "The amount of time that live video is streamed, in seconds.",
                "example": 30
              },
              "deIdEnabled": {
                "$ref": "#/components/schemas/deIdEnabled"
              },
              "deIdBacklogEnabled": {
                "$ref": "#/components/schemas/deIdBacklogEnabled"
              },
              "deIdEnableStrictBlurring": {
                "$ref": "#/components/schemas/deIdEnableStrictBlurring"
              },
              "enableAdasCalibration": {
                "$ref": "#/components/schemas/enableAdasCalibration"
              }
            }
          }
        ]
      },
      "extendedOrganizationDetails": {
        "type": "object",
        "title": "Extended Organization Details.",
        "description": "The organization details object.",
        "required": [
          "deIdAnalyticsAllowed",
          "resellerName"
        ],
        "properties": {
          "deIdAnalyticsAllowed": {
            "type": "boolean"
          },
          "resellerName": {
            "type": "string",
            "description": "The name of the partner.",
            "example": "Reseller Name"
          }
        }
      },
      "organizationDetails": {
        "title": "Retrieve List of Organization - extended",
        "description": "The extended list of organization object.",
        "allOf": [
          {
            "$ref": "#/components/schemas/extendedOrganization"
          },
          {
            "$ref": "#/components/schemas/extendedOrganizationDetails"
          }
        ]
      },
      "extendedSingleOrganization": {
        "title": "Single Organization - extended",
        "description": "The extended single organization object.",
        "allOf": [
          {
            "$ref": "#/components/schemas/extendedOrganization"
          },
          {
            "type": "object",
            "required": [
              "deviceRetentionMinutes",
              "deIdAnalyticsAllowed",
              "usersCount",
              "devicesCount",
              "hasGeotabUserSetup"
            ],
            "properties": {
              "deviceRetentionMinutes": {
                "$ref": "#/components/schemas/deviceRetentionMinutes"
              },
              "deIdAnalyticsAllowed": {
                "type": "boolean"
              },
              "usersCount": {
                "type": "number",
                "description": "The number of users",
                "example": 10
              },
              "devicesCount": {
                "type": "number",
                "description": "The number of devices.",
                "example": 17
              },
              "hasGeotabUserSetup": {
                "type": "boolean"
              },
              "ssoSecret": {
                "type": "string",
                "description": "A confidential key used for secure validation and authorization of single sign-on requests. This can only be retrieved by using a partner token.",
                "example": "6955b3f79gbbdcbbfe5632304bb036f2749db3af19bc86ffaee0c47bfc44f6f8"
              }
            }
          }
        ]
      },
      "modifiableEvents": {
        "title": "Configurable Events",
        "description": "Possible values:\n- `acceleration`: the driver increases speed suddenly.\n- `accOff`: the device is shut down.\n- `accOn`: the device is turned on or woken up from standby mode to active mode\n- `button`: the driver manually triggers an event when he spots an unusual incident worth alerting about. To manually trigger an event, the driver presses the SOS button on the device\n- `coverOpened`: the protective cover over the SD and SIM card slots is opened\n- `deceleration`: the driver reduces speed significantly\n- `distractedDriving`: the driver is generally distracted from the road\n- `geoFence`: the driver enters or exits a geofence\n- `jolt`: the vehicle moves suddenly while in standby mode. If this is set as a video event, the recording only begins after the event is triggered, since the camera does not generally record during standby mode\n- `sharpTurnLeft`: the driver turns left quickly\n- `sharpTurnRight`: the driver turns right quickly\n- `speedLimit`: the driver travels at a speed above the speed limit designated in the cloud. The speed is detected through the GPS\n- `powerDisconnectAlarm`: the power cable is removed from the device\n- `smoking`: the driver is smoking\n- `foodDrink`: the driver is eating or drinking\n- `cellPhoneUse`: the driver is using their cell phone\n- `driverUnbelted`: the driver does not have their seat belt fastened\n- `wrongPinCode`: an incorrect PIN has been entered three times within three minutes. This applies to both administrators and drivers.\n- `gsensorHigh`: the g-force of the vehicle is higher than it should be, and is even higher than the level that triggers a g-sensor regular event.\n- `gsensorRegular`: the g-force of the vehicle is higher than it should be.\n- `accident`: the g-force of the vehicle is very high, indicating a possible collision.\n- `tailgating`: the vehicle is too close to the vehicle in front of it. For this event to be triggered the Advanced Driver Assistance System (ADAS) must be calibrated.\n- `obstruction`: The in-cab lens is fully covered for more than forty seconds.\n- `laneWeaving`: the driver crosses over too many lanes in a certain amount of time. For this event to be triggered the Advanced Driver Assistance System (ADAS) must be calibrated.\n- `possibleFatigue`: a distracted driving event occurs, and the driver has been driving for at least the configured number of hours during one 24 hour period. The 24 hour period is calculated as the time between 00:00 and 23:59 UTC (Coordinated Universal Time).\n- `qrCode`: the device scans a QR code.\n- `standbyEnter`: the device enters into standby mode. Device must be connected to a constant power source for this feature. GPS information is included in these events. In the AI-14, this event is available as a text notification only, without video or a snapshot attached.\n- `standbyExit`: the device wakes up from standby mode. Device must be connected to a constant power source for this feature. GPS information is included in these events. In the AI-14, this event is available as a text notification only, without video or a snapshot attached.\n- `deviceActivation`: the device activates after connecting to the cloud.\n- `driverCheckIn`: the driver is checked in by the device, through a QR code or entering a 5 digit driver PIN code. This will be available with the version 3.12 firmware upgrade.\n- `driverCheckOut`: the driver is checked out through the device UI and removed from the device. This will be available with the version 3.12 firmware upgrade.\n- `noCheckIn`: the driver did not check-in through the device when prompted. This will be available with the version 3.12 firmware upgrade.\n- `sdCardFormatted`: the SD card was formatted.\n- `fatigue`: the driver appears fatigued, sleepy. Available only from version 3.11.30(Internal).\n- `passengerUnbelted`: the passenger does not have their seat belt fastened. Available only from version 3.12.0.\n- `ignitionOn`: configure whether to turn on or off \"ignition on\" event if ignition is turned on. `virtualIgnition` must be turned off for this feature.  This event is available as a text notification, without video or a snapshot attached. Available only for AI-14 devices\n- `ignitionOff`: configure whether to turn on or off \"ignition off\" event if ignition is turned off. `virtualIgnition` must be turned off for this feature.  This event is available as a text notification, without video or a snapshot attached. Available only for AI-14 devices\n- `passengerLimit`: the total number of passengers, including the driver, exceeds the maximum number configured in the device settings. This call is currently in beta; contact your Technical Account Manager for more information.\n- `thermalShutdownEnter`: configure whether to turn on or off the thermal shutdown notification event if device overheats. This event is available as a text notification, without video or a snapshot attached. This event is available only for AI-14 devices with firmware 14.2.109 or above\n- `yawn`: the driver is yawning. This event is available only for AI-12 devices with firmware 3.14.0 or above\n- `followingDistance`:\n    An alert is issued when a driver's vehicle maintains a distance of 1 second or less from the vehicle ahead of him for 10 consecutive seconds.\n    An event is created on the second alert within 2 hours.\n    This event is available only for AI-14 devices with firmware 14.4.0 or above\n- `criticalDistance`:\n    An event is created when a driver's vehicle is estimated to collide with the vehicle ahead of it within 2.3 seconds.\n    This estimate is based on the vehicle speed and the distance between them.\n    This event is available only for AI-14 devices with firmware 14.4.0 or above\n- `rollingStop`:\n    An event is created when a stop sign is detected and the vehicle proceeds through the intersection at a speed of 3 mph or greater.\n    This event is available only for AI-14 devices with firmware 14.4.0 or above\n- `driverChangeDetection`:\n    An event is created when a new driver begins operating the vehicle.\n    This is currently in restricted access beta. Please contact your Technical Account Manager for more information.\n- `unfamiliarDriver`:\n    An event is created when an unfamiliar or unrecognized driver is detected operating the vehicle.\n    This event is available for AI-12 and AI-14 devices.This is currently in restricted access beta.\n",
        "type": "string",
        "enum": [
          "cellPhoneUse",
          "acceleration",
          "accOff",
          "accOn",
          "button",
          "collision",
          "coreConnection",
          "coverOpened",
          "deceleration",
          "distractedDriving",
          "geoFence",
          "jolt",
          "shakingEnded",
          "shakingStarted",
          "sharpTurnLeft",
          "sharpTurnRight",
          "speedLimit",
          "powerDisconnectAlarm",
          "smoking",
          "foodDrink",
          "driverUnbelted",
          "wrongPinCode",
          "gsensorHigh",
          "gsensorRegular",
          "accident",
          "tailgating",
          "obstruction",
          "laneWeaving",
          "possibleFatigue",
          "qrCode",
          "standbyEnter",
          "standbyExit",
          "deviceActivation",
          "driverCheckIn",
          "driverCheckOut",
          "noCheckIn",
          "sdCardFormatted",
          "fatigue",
          "passengerUnbelted",
          "ignitionOn",
          "ignitionOff",
          "passengerLimit",
          "thermalShutdownEnter",
          "yawn",
          "followingDistance",
          "criticalDistance",
          "rollingStop",
          "driverChangeDetection",
          "unfamiliarDriver"
        ]
      },
      "unmodifiableEvents": {
        "title": "Unconfigurable Events",
        "description": "Possible values:\n- `virtualEvent`: an event created by the user through the POST /devices/{imei}/virtual-event call or triggered by a third party\n- `smokingBeep`: the driver gets an audio and visual alert that they might be smoking. After a few alerts with no change from the driver, a smoking event is created\n- `foodDrinkBeep`: the driver gets an audio and visual alert that they might be eating or drinking. After a few alerts with no change from the driver, a foodDrink event is created\n- `cellPhoneUseBeep`: the driver gets an audio and visual alert that they might be using their cell phone. After a few alerts with no change from the driver, a cellPhoneUse event is created\n- `driverUnbeltedBeep`: the driver gets an audio and visual alert that they might have their seat belt unbelted. After a few alerts with no change from the driver, a driverUnbelted event is created\n- `distractedDriverBeep`: the driver gets an audio and visual alert that they might be driving inattentively. After a few alerts with no change, a distractedDriving event is created\n- `yawnBeep`: the driver gets an audio and visual alert that they might be yawning. After a few alerts with no change from the driver, a yawn event is created\n",
        "type": "string",
        "enum": [
          "virtualEvent",
          "smokingBeep",
          "foodDrinkBeep",
          "cellPhoneUseBeep",
          "driverUnbeltedBeep",
          "distractedDriverBeep",
          "yawnBeep"
        ]
      },
      "eventType": {
        "title": "All Events",
        "description": "All Events",
        "type": "string",
        "oneOf": [
          {
            "$ref": "#/components/schemas/modifiableEvents"
          },
          {
            "$ref": "#/components/schemas/unmodifiableEvents"
          }
        ]
      },
      "organizationId": {
        "title": "Organization ID",
        "description": "The ID of the organization. Obtain this from GET /organizations.",
        "type": "number",
        "example": 17
      },
      "organizationIdRequiredForPartner": {
        "title": "Organization ID",
        "description": "The ID of the organization. Obtain this from GET /organizations. (When using partner token, Organization ID is required.)",
        "type": "number",
        "example": 17
      },
      "organizationIdString": {
        "title": "Organization ID as string",
        "description": "The ID of the organization, as a string. Obtain this from GET /organizations.",
        "type": "string",
        "pattern": "^[1-9]\\d*$",
        "example": "17"
      },
      "organizationName": {
        "title": "Organization name",
        "description": "The name assigned to the organization in POST /organizations.",
        "type": "string",
        "example": "Company Name"
      },
      "organizationExclusivePartnerOnly": {
        "title": "Organization can contain devices of one partner or multiple partners",
        "description": "When enabled, the organization can only contain devices from the partner that originally created the organization. When disabled, the organization can contain devices from multiple partners.",
        "type": "boolean"
      },
      "organizationDeIdEnabled": {
        "title": "Organizations can have the Blurring service enabled/disabled",
        "description": "When enabled, the organization can have the Blurring service turned on for the devices. If disabled, the Blurring service cannot be turned on for the devices. <br><br>Note: These settings for exisitng organizations are automatically inherited from the partner configuration. The Blurring service will only work for the organization if it was also turned on at a partner level.",
        "type": "boolean"
      },
      "organizationDeIdEnableStrictBlurring": {
        "title": "Adds more blurred area and blurring intensity",
        "description": "Strict blurring prioritizes privacy over False positives. It adds a larger blurred area and blurring intensity. When enabled, the organization can have strict blurring turned on for all devices. Strict blurring provides an improvement in blurring accuracy and is enabled by default for organizations who want higher privacy at the cost of a minor increase in false positives. <br><br>Note: These settings for exisitng organizations are automatically inherited from the partner configuration. Strict Blurring service will only work for the organization if it is also turned on at a partner level.",
        "type": "boolean"
      },
      "organizationDeIdBacklogEnabled": {
        "title": "Media blurring service in backlog enabled/disabled",
        "description": "When enabled, blurring service will be enabled for all the media files in the backlog. If disabled, the blurring service will be available only for real-time requests.",
        "type": "boolean"
      },
      "notificaitonEnabled": {
        "title": "Notificaiton Enabled",
        "description": "Indicates whether or not the webhook notification is enabled.",
        "type": "boolean",
        "example": true
      },
      "thresholdSet": {
        "title": "Threshold Set",
        "description": "Indicates whether or not the usage threshold is set.",
        "type": "boolean",
        "example": true
      },
      "dataUsageMegabytes": {
        "title": "Data Usage In Megabytes",
        "description": "Device data usage in megabytes.",
        "type": "number",
        "example": 30
      },
      "videoEventsMegabytes": {
        "title": "Video Events In Megabytes",
        "description": "Device video events data usage in megabytes.",
        "type": "number",
        "example": 45
      },
      "liveVideoMegabytes": {
        "title": "Live Video Events In Megabytes",
        "description": "Device live video events data usage in megabytes.",
        "type": "number",
        "example": 35
      },
      "recordingUploadedMegabytes": {
        "title": "Recording Uploads In Megabytes",
        "description": "Device recording uploads data usage in megabytes.",
        "type": "number",
        "example": 40
      },
      "recordStreamingMegabytes": {
        "title": "Recorded Streaming In Megabytes",
        "description": "Device recorded video streaming data usage in megabytes.",
        "type": "number",
        "example": 0
      },
      "billingDate": {
        "title": "Billing Date",
        "description": "Billing date based on the data profile.",
        "type": "string",
        "format": "date",
        "example": "2025-07-10"
      },
      "groupName": {
        "title": "Group name",
        "description": "The name assigned to the group.",
        "type": "string",
        "minLength": 1,
        "example": "Cool Name"
      },
      "partner": {
        "type": "object",
        "title": "Partner",
        "description": "The partner object.",
        "required": [
          "id",
          "name",
          "alarmsCount"
        ],
        "properties": {
          "id": {
            "$ref": "#/components/schemas/partnerId"
          },
          "name": {
            "$ref": "#/components/schemas/partnerName"
          },
          "alarmsCount": {
            "type": "number",
            "description": "The number of unread alarms associated with the partner.",
            "example": 7
          },
          "measurement": {
            "type": "number",
            "description": "The measurement units used in the cloud.<br><br> type 1 - us/imperial, type 2 - metric"
          },
          "timeFormat": {
            "type": "number",
            "description": "The time format used in the cloud.<br><br> type 1 - 24 hours, type 2 - am/pm"
          },
          "oauthEnabled": {
            "type": "boolean",
            "description": "Indicates whether OAuth is enabled for the partner."
          },
          "parentResellerId": {
            "type": "number",
            "nullable": true,
            "description": "The ID of the parent reseller, if this is a sub-partner. null if this is a parent partner."
          }
        }
      },
      "partnerContact": {
        "type": "object",
        "title": "Partner contact",
        "description": "The partner contact object.",
        "required": [
          "name",
          "email"
        ],
        "properties": {
          "name": {
            "type": "string",
            "description": "The name assigned to the entity. The partner contact name is assigned in the POST /partners/{partnerId}/contacts call.",
            "example": "Harry"
          },
          "email": {
            "$ref": "#/components/schemas/email"
          }
        }
      },
      "extendedPartnerContact": {
        "title": "Partner contact - extended",
        "description": "The extended partner contact object",
        "allOf": [
          {
            "$ref": "#/components/schemas/partnerContact"
          },
          {
            "type": "object",
            "required": [
              "id",
              "role"
            ],
            "properties": {
              "id": {
                "type": "integer",
                "description": "The ID of the entity. Obtain this from GET /partner-contacts.",
                "example": 23
              },
              "role": {
                "type": "string",
                "description": "The role of the entity.",
                "enum": [
                  "partner",
                  "partnerContact"
                ]
              }
            }
          }
        ]
      },
      "postPartnerContact": {
        "title": "Partner contact - extended",
        "description": "The extended partner contact object",
        "allOf": [
          {
            "$ref": "#/components/schemas/partnerContact"
          },
          {
            "type": "object",
            "required": [
              "id",
              "role"
            ],
            "properties": {
              "id": {
                "type": "integer",
                "description": "The ID of the entity. Obtain this from GET /partner-contacts.",
                "example": 23
              },
              "role": {
                "type": "string",
                "description": "The role of the entity.",
                "enum": [
                  "partnerContact"
                ]
              }
            }
          }
        ]
      },
      "partnerId": {
        "title": "Partner ID",
        "description": "The ID of the partner. Obtain this from GET /partner-contacts.",
        "type": "number",
        "example": 1
      },
      "partnerName": {
        "title": "Partner name",
        "description": "The name of the partner.",
        "type": "string",
        "example": "James"
      },
      "partnerOperationalStatistics": {
        "title": "Partner operation statistics",
        "description": "The partner operation statistics object.",
        "type": "object",
        "properties": {
          "devices": {
            "title": "Summary of partner devices activations",
            "description": "A summary of the partner’s device activations.",
            "type": "object",
            "properties": {
              "total": {
                "title": "Total partner devices count",
                "description": "The total number of devices associated with the partner.",
                "type": "integer",
                "minimum": 0,
                "example": 53
              },
              "activated": {
                "title": "Active partner devices count",
                "description": "The total number of active devices associated with the partner.",
                "type": "integer",
                "minimum": 0,
                "example": 43
              },
              "deactivated": {
                "title": "Deactivated partner devices count",
                "description": "The total number of deactivated devices associated with the partner.",
                "type": "integer",
                "minimum": 0,
                "example": 10
              },
              "pendingActivation": {
                "title": "Pending activation partner devices count",
                "description": "The total number of devices pending activation associated with the partner.",
                "type": "integer",
                "minimum": 0,
                "example": 10
              },
              "suspended": {
                "title": "Suspended partner devices count",
                "description": "The total number of suspended devices associated with the partner.",
                "type": "integer",
                "minimum": 0,
                "example": 10
              }
            }
          },
          "trends": {
            "title": "Periodic trends of partner device activations and organizations",
            "description": "The trends of device activations and organizations associated with the partner over specific periods of time.",
            "type": "object",
            "properties": {
              "activations": {
                "title": "Partner device activation trends",
                "description": "The device activations associated with the partner for previous months and weeks.",
                "properties": {
                  "total": {
                    "title": "Total activated devices of the partner",
                    "description": "The total number of device activations associated with the partner.",
                    "type": "integer",
                    "minimum": 0,
                    "example": 53
                  },
                  "previousMonths": {
                    "type": "array",
                    "items": {
                      "title": "Previous months device activations counts",
                      "description": "The number of device activations associated with the partner from the previous months.",
                      "$ref": "#/components/schemas/monthlyAggregateResult"
                    }
                  },
                  "previousWeeks": {
                    "type": "array",
                    "items": {
                      "title": "Previous weeks device activations counts",
                      "description": "The number of device activations associated with the partner from the previous weeks.",
                      "$ref": "#/components/schemas/weeklyAggregateResult"
                    }
                  }
                }
              },
              "organizations": {
                "title": "Partner organization creation trends",
                "description": "The new organization associated with the partner for previous months and weeks.",
                "properties": {
                  "total": {
                    "title": "Total organizations of the partner",
                    "description": "The total number of new organizations associated with the partner.",
                    "type": "integer",
                    "minimum": 0,
                    "example": 53
                  },
                  "previousMonths": {
                    "type": "array",
                    "items": {
                      "title": "Previous months created organizations count",
                      "description": "The number of new organizations associated with the partner from the previous months.",
                      "$ref": "#/components/schemas/monthlyAggregateResult"
                    }
                  },
                  "previousWeeks": {
                    "type": "array",
                    "items": {
                      "title": "Previous weeks created organizations counts",
                      "description": "The number of new organizations associated with the partner from the previous weeks.",
                      "$ref": "#/components/schemas/weeklyAggregateResult"
                    }
                  }
                }
              }
            }
          },
          "devicesByOrganization": {
            "type": "array",
            "items": {
              "title": "Devices count by organization",
              "description": "The number of devices associated with organizations array.",
              "required": [
                "organizationId",
                "name",
                "count"
              ],
              "properties": {
                "organizationId": {
                  "$ref": "#/components/schemas/organizationId"
                },
                "name": {
                  "$ref": "#/components/schemas/organizationName"
                },
                "count": {
                  "title": "Count devices per organization",
                  "description": "The number of devices associated with the organization.",
                  "type": "integer",
                  "minimum": 0,
                  "example": 53
                }
              }
            }
          },
          "recordingHealthFailedByOrganization": {
            "type": "array",
            "title": "Recording health failed devices of the partner by organization",
            "description": "The number of devices with failed recording health in organizations array.",
            "items": {
              "title": "Recording health failed devices per organization",
              "description": "The number of devices with failed recording health in each organization.",
              "required": [
                "organizationId",
                "name",
                "count"
              ],
              "properties": {
                "organizationId": {
                  "$ref": "#/components/schemas/organizationId"
                },
                "name": {
                  "$ref": "#/components/schemas/organizationName"
                },
                "count": {
                  "title": "Count devices with recording health failed per organization",
                  "description": "The number of devices with failed recording health in the organization.",
                  "type": "integer",
                  "minimum": 0,
                  "example": 1
                }
              }
            }
          },
          "recordingHealthSummary": {
            "type": "array",
            "title": "Partner devices recording health summary",
            "description": "The recording health of devices associated with the partner array.",
            "items": {
              "properties": {
                "recordingTestResult": {
                  "title": "Recording Test Result",
                  "description": "The result of the recording health test.",
                  "type": "string",
                  "enum": [
                    "passed",
                    "failed",
                    "notTested"
                  ]
                },
                "count": {
                  "title": "Count of recording health devices",
                  "description": "The number of devices with the recording health test result.",
                  "type": "integer",
                  "minimum": 0,
                  "example": 27
                }
              }
            }
          },
          "alarmsByOrganization": {
            "type": "array",
            "title": "Alarms count by organization",
            "description": "The number of alarms associated with organizations array.",
            "items": {
              "type": "object",
              "title": "Alarms count by organization",
              "description": "The number of alarms associated with each organization.",
              "required": [
                "organizationId",
                "name",
                "count"
              ],
              "properties": {
                "organizationId": {
                  "$ref": "#/components/schemas/organizationId"
                },
                "name": {
                  "$ref": "#/components/schemas/organizationName"
                },
                "count": {
                  "title": "Alarms count per Organization",
                  "description": "The number of alarms associated with the organization.",
                  "type": "integer",
                  "minimum": 0,
                  "example": 1
                }
              }
            }
          },
          "alarmsByType": {
            "type": "array",
            "title": "Alarms count by type",
            "description": "The number of alarms for each alarm type array.",
            "items": {
              "title": "Alarms count by type",
              "description": "The number of alarms for each alarm type.",
              "required": [
                "alarmDefinitionId",
                "name",
                "count"
              ],
              "properties": {
                "alarmDefinitionId": {
                  "$ref": "#/components/schemas/alarmDefinitionId"
                },
                "name": {
                  "title": "Alarm Name",
                  "description": "The name of the alarm definition.",
                  "type": "string",
                  "example": "Driver dashcam recording failure"
                },
                "count": {
                  "title": "Alarms count per organization",
                  "description": "The number of alarms associated with the organization.",
                  "type": "integer",
                  "minimum": 0,
                  "example": 1
                }
              }
            }
          },
          "adasCalibrationSummary": {
            "type": "array",
            "title": "ADAS Calibration Summary for Partner",
            "description": "Summary of ADAS calibration statistics for AI-12 and AI-14 devices associated with the partner.",
            "items": {
              "type": "object",
              "properties": {
                "productType": {
                  "title": "Device Type",
                  "type": "string",
                  "enum": [
                    "AI-12",
                    "AI-14"
                  ],
                  "description": "Indicates whether the device belongs to the AI-12 or AI-14 category.",
                  "example": "AI-12"
                },
                "totalDevice": {
                  "title": "Total Devices",
                  "type": "integer",
                  "minimum": 0,
                  "description": "The total number of devices associated with the partner.",
                  "example": 25
                },
                "adasCalibrationCount": {
                  "title": "Calibrated Devices",
                  "type": "integer",
                  "minimum": 0,
                  "description": "Represents the number of devices associated with partners who have successfully completed the ADAS calibration.",
                  "example": 20
                }
              }
            }
          }
        }
      },
      "simulatedAlarmResponseData": {
        "type": "object",
        "properties": {
          "alarmId": {
            "type": "number",
            "description": "The ID of the alarm that was created.",
            "example": 18765
          },
          "isWebhookSent": {
            "type": "boolean",
            "description": "Was the webhook sent successfully.",
            "example": true
          }
        }
      },
      "whiteLabelConfiguration": {
        "type": "object",
        "properties": {
          "whiteLabelName": {
            "type": "string",
            "description": "The name of the white label portal.",
            "example": "Fast Fleets Inc."
          },
          "whiteLabelDomainAddress": {
            "type": "string",
            "description": "The domain address of the white label portal.",
            "example": "login.fast-fleets.com"
          },
          "whiteLabellogoUrl": {
            "type": "string",
            "description": "A URL to the logo of the white label portal.",
            "example": "https://whitelabel.s3.us-east-2.amazonaws.com/fastfleets/logo.png"
          },
          "whiteLabelDesktopPictureUrl": {
            "type": "string",
            "description": "A URL to the desktop image of the white label portal.",
            "example": "https://whitelabel.s3.us-east-2.amazonaws.com/fastfleets/desktop.png"
          },
          "whiteLabelIpadPictureUrl": {
            "type": "string",
            "description": "A URL to the tablet image of the white label portal.",
            "example": "https://whitelabel.s3.us-east-2.amazonaws.com/fastfleets/tablet.png"
          },
          "whiteLabelMobilePictureUrl": {
            "type": "string",
            "description": "A URL to the mobile image of the white label portal.",
            "example": "https://whitelabel.s3.us-east-2.amazonaws.com/fastfleets/phone.png"
          },
          "whiteLabelPrivacyPolicyUrl": {
            "type": "string",
            "description": "A URL to the privacy policy of the white label portal.",
            "example": "https://surfsight.net/privacy_policy/"
          },
          "whiteLabelEulaUrl": {
            "type": "string",
            "description": "A URL to the EULA of the white label portal.",
            "example": "https://surfsight.com/eula"
          },
          "whiteLabelFaviconUrl": {
            "type": "string",
            "description": "A URL to the favicon of the white label portal.",
            "example": "https://whitelabel.s3.us-east-2.amazonaws.com/fastfleets/favicon.png"
          },
          "whiteLabelInfoEmail": {
            "type": "string",
            "description": "The sender address for emails from the white label portal to users.",
            "example": "support@fast-fleets.com"
          },
          "whiteLabelThemeName": {
            "type": "string",
            "description": "The color theme of the white label portal.",
            "enum": [
              "red",
              "pink",
              "purple",
              "deep-purple",
              "indigo",
              "blue",
              "light-blue",
              "cyan",
              "teal",
              "teal2",
              "green",
              "light-green",
              "lime",
              "yellow",
              "amber",
              "orange",
              "deep-orange",
              "brown",
              "grey",
              "blue-grey"
            ],
            "example": "red"
          },
          "whiteLabelThemeColor": {
            "type": "string",
            "description": "The hex color code of the white label portal.",
            "pattern": "^#(?:[0-9a-fA-F]{3}){1,2}$",
            "example": "#f44336"
          }
        }
      },
      "password": {
        "title": "Password",
        "description": "The password must contain at least eight characters, including one upper-case letter, one lower-case letter, and one number. The password may consist of a combination of letters, numbers, and special characters.",
        "type": "string",
        "minLength": 8,
        "format": "password",
        "example": "123Abcd!"
      },
      "organizationPurgeDays": {
        "title": "Purge time",
        "description": "The amount of time that an organization’s data is retained in the cloud before being purged, in days. The default general purge time is 31 days. To increase the purge time above this amount, speak to your partner success manager (PSM).<br><br> Purge times can be set separately for each camera type (1 - road-facing lens, 2 - in-cab lens, 50+ - auxiliary cameras.)",
        "type": "number",
        "minimum": 1,
        "maximum": 366,
        "example": 90
      },
      "deviceRetentionMinutes": {
        "type": "number",
        "minimum": 4,
        "title": "Recording retention configuration for all devices in an organization",
        "description": "The configuration of the recording retention for all devices in the specified organization. The recording retention is how long recordings are stored on the SD card until they get overwritten with new recordings. This field sets the value for all of the devices in the specified organization."
      },
      "isOrganizationProfileEnabled": {
        "description": "Enable the organization profile for all devices. If disabled, the organization profile does not apply, and each device is managed separately. <br><br>This profile enables you to configure all devices in the organization with the same configuration. When turned on, all newly added devices are automatically configured with this profile. When turned off, newly added devices do not get the configuration from this profile. <br><br>Note: When enabled and users configure settings with a combination of single, bulk, and this profile, each device is configured based on its most recent updates, regardless of the method selected.",
        "type": "boolean",
        "default": false
      },
      "isOrganizationProfileEnabledDescriptionForPatch": {
        "description": "Enable the Organization profile for all devices. When enabled, any changes to the Organization's default device or default event settings are applied to existing devices. Newly added devices inherit the default settings. When disabled, the organization profile does not apply and each device is managed separately. <br><br>This profile enables you to configure all devices in the organization with the same configuration. When turned on, all newly added devices are automatically configured with this profile. When turned off, newly added devices do not get the configuration from this profile. <br><br>Note: When enabled and users configure settings with a combination of single, bulk, and this profile, each device is configured based on its most recent updates, regardless of the method selected.",
        "type": "boolean"
      },
      "deIdEnabled": {
        "type": "boolean",
        "description": "When enabled, the organization can have the Blurring service turned on for the devices. If disabled, the Blurring service cannot be turned on for the devices. <br><br>Note: These settings for exisitng organizations are automatically inherited from the partner configuration. The Blurring service will only work for the organization if it was also turned on at a partner level.",
        "example": false,
        "default": false
      },
      "deIdBacklogEnabled": {
        "type": "boolean",
        "description": "When enabled, blurring service will be enabled for all the media files in the backlog. If disabled, the blurring service will be available only for real-time requests.",
        "example": false,
        "default": false
      },
      "deIdEnableStrictBlurring": {
        "type": "boolean",
        "description": "Strict blurring prioritizes privacy over False positives. It adds a larger blurred area and blurring intensity. When enabled, the organization can have strict blurring turned on for all devices. Strict blurring provides an improvement in blurring accuracy and is enabled by default for organizations who want higher privacy at the cost of a minor increase in false positives. <br><br>Note: These settings for exisitng organizations are automatically inherited from the partner configuration. Strict Blurring service will only work for the organization if it is also turned on at a partner level.",
        "example": false,
        "default": false
      },
      "enableAdasCalibration": {
        "type": "boolean",
        "description": "When enabled, the Advanced Driver Assistance Systems (ADAS) calibration features will be available for the organization. This setting determines whether the ADAS calibration can be performed on the organization’s devices.",
        "example": false,
        "default": false
      },
      "retentionConfig": {
        "type": "array",
        "title": "Recording retention configuration",
        "description": "The camera recording retention configuration array. The recording retention is how long recordings are stored on the SD card until they get overwritten with new recordings.",
        "example": "[{\"cameraId\":1, \"retentionMinutes\":30}, {\"cameraId\":2, \"retentionMinutes\":30},{\"cameraId\":51, \"retentionMinutes\":30}]",
        "items": {
          "description": "The camera recording retention configuration object.",
          "type": "object",
          "required": [
            "cameraId",
            "retentionMinutes"
          ],
          "properties": {
            "cameraId": {
              "$ref": "#/components/schemas/cameraId"
            },
            "retentionMinutes": {
              "description": "The recording retention time, in minutes.",
              "type": "number",
              "minimum": 4
            }
          }
        }
      },
      "requestId": {
        "title": "Request ID",
        "type": "string",
        "description": "The ID of the request.",
        "example": "06327cae-e075-42ca-b620-c5cfdd3b4e37"
      },
      "role": {
        "type": "string",
        "title": "Role",
        "description": "The role of the entity.",
        "enum": [
          "restricted",
          "user",
          "administrator",
          "supervisor",
          "usermapviewer"
        ]
      },
      "accessLevel": {
        "type": "string",
        "title": "accessLevel",
        "description": "The access level of the entity.",
        "default": "editor",
        "enum": [
          "viewer",
          "editor",
          "editorWithoutMediaAccess"
        ]
      },
      "sdCardFreeBytes": {
        "title": "SD card free space",
        "description": "The free space left on the SD card, in bytes.",
        "type": "integer",
        "example": 46724284416
      },
      "sdCardInserted": {
        "title": "SD card insertion state",
        "description": "Whether the SD card of the device is inserted ",
        "type": "boolean"
      },
      "sdCardCapacityBytes": {
        "title": "SD card size",
        "description": "The size of the SD card, in bytes",
        "type": "integer",
        "example": 127817449472
      },
      "simNumber": {
        "title": "SIM number",
        "description": "The SIM number of the device.",
        "type": "string",
        "example": "12345678"
      },
      "simNetworkType": {
        "title": "SIM network type",
        "description": "The network type of the device SIM card.",
        "type": "string",
        "example": "4G"
      },
      "simState": {
        "title": "SIM state",
        "description": "The state of the device SIM card.",
        "type": "string",
        "enum": [
          "ready",
          "absent",
          "unknown",
          "network locked",
          "PIN required",
          "PUR required"
        ],
        "example": "ready"
      },
      "wifiEnabled": {
        "title": "Wi-Fi Enabled",
        "description": "Whether the Wi-Fi is enabled ",
        "type": "boolean"
      },
      "wifiConnected": {
        "title": "Wi-Fi Connected",
        "description": "Whether the Wi-Fi is connected ",
        "type": "boolean"
      },
      "wifiSignalLevel": {
        "title": "Wi-Fi Signal Level",
        "description": "The signal level of the Wi-Fi, in dBm. This ranges between -100 and 0. Anything from -100 to -70 is considered a bad signal, while anything above -70 is a good signal.",
        "type": "string",
        "example": "-50"
      },
      "cameras": {
        "description": "The cameras array.",
        "type": "array",
        "items": {
          "description": "The privacy settings for a specific camera object.",
          "type": "object",
          "properties": {
            "cameraId": {
              "$ref": "#/components/schemas/cameraId"
            },
            "recordingEnabled": {
              "description": "Enable or disable recording for the camera.",
              "type": "boolean"
            },
            "eventsEnabled": {
              "description": "Include or exclude media from this camera in events.",
              "type": "boolean"
            }
          }
        }
      },
      "auxCameras": {
        "title": "Auxiliary Cameras",
        "description": "Information about auxiliary cameras that are currently connected to the dashcam.",
        "type": "array",
        "items": {
          "description": "The auxiliary cameras diagnostics object.",
          "type": "object",
          "properties": {
            "cameraId": {
              "type": "number",
              "description": "The auxiliary camera ID.",
              "example": 51
            },
            "model": {
              "type": "string",
              "description": "The model of the auxiliary camera.",
              "example": "LT52200"
            },
            "fwVersion": {
              "type": "string",
              "description": "The firmware version of the auxiliary camera.",
              "example": "VER_ 0.27.0"
            },
            "ipAddress": {
              "type": "string",
              "description": "The LAN IP address of auxiliary camera.",
              "example": "http://192.168.88.252"
            },
            "state": {
              "type": "string",
              "description": "The state of the auxiliary camera.",
              "enum": [
                "connected",
                "recording",
                "notConnected"
              ],
              "example": "connected"
            },
            "sdStatus": {
              "type": "string",
              "description": "The status of the SD card, whether it is inserted or not.<br>For the AI-RAC-1 and AI-SAC-1 Wi-Fi auxiliary cameras, \"normal\" means the SD card is inserted, and \"nocard\" means the SD card is not inserted.<br>For the Wi-Fi DC-ACW-01 and DC-ACW-02 auxiliary cameras, and the Wired DC-ACE-01 and DC-ACE-02 auxiliary cameras, \"ready\" means the SD card is inserted, and \"out\" means the SD card is not inserted.",
              "example": "normal",
              "enum": [
                "normal",
                "nocard",
                "ready",
                "out"
              ]
            },
            "sdFreeSpace": {
              "type": "string",
              "description": "The free space left on the SD card.",
              "example": "119808 KB"
            },
            "sdTotalSpace": {
              "type": "string",
              "description": "The total amount of space on the SD card.",
              "example": "61054976 KB"
            }
          }
        }
      },
      "hotSpot": {
        "description": "Internet access",
        "type": "object",
        "required": [
          "internetAccess"
        ],
        "properties": {
          "internetAccess": {
            "description": "Enable or disable the ability of the device to connect to the internet with Wi-Fi. ",
            "type": "boolean",
            "default": false
          },
          "hotspotEnabled": {
            "description": "Enable or disable the ability of the device to act as a mobile hotspot.",
            "type": "boolean",
            "default": true
          }
        }
      },
      "speedMps": {
        "title": "Speed",
        "description": "The actual speed of the vehicle, in meters per second.",
        "type": "number",
        "example": 22.51
      },
      "speedKmh": {
        "title": "Speed",
        "description": "The actual speed of the vehicle, in kilometers per hour.",
        "type": "number",
        "example": 81.04
      },
      "postedSpeed": {
        "title": "Posted speed",
        "description": "The general speed limit for most vehicles that is posted at the specific geographical point, in meters per second. This is included as part of the GPS metadata.",
        "type": "number",
        "example": 100
      },
      "postedSpeedHgv": {
        "title": "postedSpeedHgv",
        "description": "The speed limit for heavy goods vehicles that is posted at the specific geographical point, in meters per second. This is included as part of the GPS metadata.",
        "type": "number",
        "example": 100
      },
      "postedSpeedTrailer": {
        "title": "postedSpeedTrailer",
        "description": "The speed limit for trailers that is posted at the specific geographical point, in meters per second. This is included as part of the GPS metadata.",
        "type": "number",
        "example": 100
      },
      "speedLimit": {
        "title": "Speed limit",
        "description": "The configurable speed limit, in km/h. When a vehicle reaches this speed, a speed limit event is generated. This is not related to posted speed limits.<br><br> This parameter is required for speedLimit events.",
        "type": "number",
        "example": 120
      },
      "drivingDuration": {
        "title": "Driving duration",
        "description": "The number of hours a driver drives in one 24 hour period before a possible fatigue event can be triggered. The 24 hour period is the time between 00:00 and 23:59 UTC (Coordinated Universal Time). If the driver drives more than the set driving duration and a distracted driving event is triggered, then a possible fatigue event is also triggered.<br><br> This parameter is required for possibleFatigue events.",
        "type": "number",
        "default": 8,
        "maximum": 20,
        "minimum": 0
      },
      "headwayAlertDayThreshold": {
        "title": "Time to collision during the day",
        "description": "The number of milliseconds a vehicle drives too closely to the vehicle in front of it during the day. When a vehicle does this, a tailgating event is generated.<br><br>\nThis parameter is required for tailgating events.\n",
        "type": "integer",
        "minimum": 1000,
        "maximum": 15000,
        "example": 2000
      },
      "headwayAlertNightThreshold": {
        "title": "Time to collision during the night",
        "description": "The number of milliseconds a vehicle drives too closely to the vehicle in front of it during the night. When a vehicle does this, a tailgating event is generated.<br><br>\nThis parameter is required for tailgating events.\n",
        "type": "integer",
        "minimum": 1000,
        "maximum": 15000,
        "example": 3000
      },
      "headwayAlertTime": {
        "title": "Continuous time to collision",
        "description": "The number of milliseconds a vehicle continuously drives too closely to the vehicle in front of it. When a vehicle does this, a tailgating event is generated.<br><br>\nThis parameter is required for tailgating events.\n",
        "type": "integer",
        "minimum": 1000,
        "maximum": 60000,
        "example": 3000
      },
      "laneWeavingTimes": {
        "title": "Number of lanes in lane crossing",
        "description": "The number of lanes the vehicle crossed over. If the vehicle crosses over a this number of lanes in a certain time range, a laneWeaving event is created.<br><br>\nThis parameter is required for laneWeaving events.\n",
        "type": "integer",
        "minimum": 2,
        "maximum": 10,
        "example": 3
      },
      "laneWeavingDurationSeconds": {
        "title": "Time range for lane crossing",
        "description": "The time range for lane crossing. If the vehicle crosses over a certain number of lanes in this time range, a laneWeaving event is created. <br><br>\nThis parameter is required for laneWeaving events.\n",
        "type": "integer",
        "minimum": 5,
        "maximum": 60,
        "example": 30
      },
      "timeWindow": {
        "type": "number",
        "description": "Time in seconds within which yawns are counted.\n",
        "default": 0,
        "minimum": 0,
        "maximum": 600
      },
      "numberOfYawns": {
        "type": "number",
        "description": "Number of yawns within the timeWindow required to trigger an alert.\n",
        "default": 1,
        "minimum": 1,
        "maximum": 20
      },
      "assumeMoving": {
        "type": "boolean",
        "description": "If speed data is unavailable or 0, assume the vehicle is moving and generate an alert.\n",
        "default": false
      },
      "visualAlert": {
        "description": "Whether or not a visual alert is shown on the device screen when an event occurs. <br><br>\nApplies to the following events: <br> <ul>acceleration</ul> <ul>deceleration</ul> <ul>distractedDriving</ul> <ul>sharpTurnLeft</ul> <ul>sharpTurnRight</ul> <ul>speedLimit</ul> <ul>smoking</ul> <ul>foodDrink</ul> <ul>cellPhoneUse</ul> <ul>driverUnbelted</ul> <ul>laneWeaving</ul> <ul>gsensorHigh</ul> <ul>gsensorRegular (from version 3.11)</ul> <ul>passengerUnbelted (from version 3.12)</ul> <ul>accident</ul> <ul>tailgating</ul> <ul>obstruction</ul> <ul>yawn</ul> <ul>button (from version 3.11)</ul> <ul>virtualEvent (from version 3.11)</ul> <ul>followingDistance (from version 14.4)</ul> <ul>criticalDistance (from version 14.4)</ul> <ul>rollingStop (from version 14.4)</ul><br><br>\n",
        "type": "boolean"
      },
      "audioAlert": {
        "description": "Whether or not an audio alert is played when an event occurs. <br><br>\nApplies to the following events: <br> <ul>acceleration</ul> <ul>deceleration</ul> <ul>distractedDriving</ul> <ul>sharpTurnLeft</ul> <ul>sharpTurnRight</ul> <ul>smoking</ul> <ul>foodDrink</ul> <ul>cellPhoneUse</ul> <ul>driverUnbelted</ul> <ul>laneWeaving</ul> <ul>gsensorHigh</ul> <ul>gsensorRegular (from version 3.11)</ul> <ul>passengerUnbelted (from version 3.12)</ul> <ul>accident</ul> <ul>tailgating</ul> <ul>obstruction</ul> <ul>yawn</ul> <ul>button (from version 3.11)</ul> <ul>virtualEvent (from version 3.11)</ul> <ul>followingDistance (from version 14.4)</ul> <ul>criticalDistance (from version 14.4)</ul> <ul>rollingStop (from version 14.4)</ul><br><br>\n",
        "type": "boolean"
      },
      "start": {
        "title": "Start date and time",
        "description": "The start date and time, in ISO 8601 format.",
        "type": "string",
        "format": "date-time",
        "example": "2020-01-01T14:48:00.000Z"
      },
      "targetEntity": {
        "type": "string",
        "title": "Target entity",
        "description": "The target entity.",
        "enum": [
          "organization",
          "partner",
          null
        ],
        "example": "organization"
      },
      "time": {
        "title": "Time",
        "description": "The time, in ISO 8601 format.",
        "type": "string",
        "format": "date-time",
        "example": "2020-01-01T14:48:00.000Z"
      },
      "token": {
        "title": "Token",
        "description": "The authentication token.<br><br> For users - valid twenty four hours. For partners - valid for fifteen minutes.",
        "type": "string",
        "example": "zskMdo9EBahb4lx4wX3GQKmxC6yOZImB1WuRa8Bbqtt"
      },
      "trip": {
        "title": "Trip",
        "description": "The trip object.",
        "type": "object",
        "required": [
          "start",
          "end",
          "duration",
          "distance",
          "maxSpeed",
          "eventsCount"
        ],
        "properties": {
          "start": {
            "$ref": "#/components/schemas/gpsPointTrip"
          },
          "end": {
            "$ref": "#/components/schemas/gpsPointTrip"
          },
          "duration": {
            "type": "number",
            "description": "The trip duration, in seconds.",
            "example": 1427
          },
          "distance": {
            "type": "number",
            "description": "The trip distance, in miles.",
            "example": 31.6
          },
          "maxSpeed": {
            "type": "number",
            "description": "The maximum speed at which the vehicle travelled during the course of the entire trip, in meters per second.",
            "example": 30.2
          },
          "eventsCount": {
            "type": "number",
            "description": "The number of events in the trip.",
            "example": 12
          }
        }
      },
      "user": {
        "type": "object",
        "title": "User",
        "description": "The user object.",
        "required": [
          "id",
          "email"
        ],
        "properties": {
          "id": {
            "$ref": "#/components/schemas/userId"
          },
          "email": {
            "$ref": "#/components/schemas/email"
          },
          "role": {
            "$ref": "#/components/schemas/role"
          },
          "measurement": {
            "type": "number",
            "description": "The measurement units used in the cloud.<br><br> type 1 - us/imperial, type 2 - metric"
          },
          "timeFormat": {
            "type": "number",
            "description": "The time format used in the cloud.<br><br> type 1 - 24 hours, type 2 - am/pm"
          },
          "groups": {
            "description": "The receive organization groups response array.",
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/group"
            }
          }
        }
      },
      "userId": {
        "title": "User ID",
        "description": "The ID of the user.",
        "type": "number",
        "example": 32
      },
      "userIdString": {
        "title": "User ID as string",
        "description": "The ID of the user, as a string.",
        "type": "string",
        "example": "32"
      },
      "vehicleType": {
        "title": "Vehicle type",
        "description": "The type of vehicle associated with the device.<br><br> The type of vehicle affects the sensitivity of the device's motion sensor. Private is the most sensitive to movements, and trailer is the least sensitive.",
        "type": "string",
        "enum": [
          "Private",
          "Van",
          "Trailer"
        ]
      },
      "webhook": {
        "type": "object",
        "title": "Webhook",
        "description": "The webhook object.",
        "required": [
          "imei",
          "url",
          "type"
        ],
        "properties": {
          "imei": {
            "$ref": "#/components/schemas/imei"
          },
          "url": {
            "type": "string",
            "description": "The URL where the webhook is posted.",
            "example": "http://mywebhook.com"
          },
          "type": {
            "type": "string",
            "description": "The type of the webhook. For the event type, every event triggered for this device is posted using the webhook. For the GPS type, all GPS information is posted. For the alarms type, every alarm is posted. For the systemMessages type, every system message triggered for this device is posted using the webhook based on config settings.",
            "enum": [
              "gps",
              "event",
              "alarms",
              "systemMessages"
            ]
          },
          "config": {
            "type": "object",
            "properties": {
              "dataProfile": {
                "$ref": "#/components/schemas/dataProfileObject"
              },
              "deviceStatus": {
                "$ref": "#/components/schemas/deviceStatusObject"
              },
              "deviceBillingStatus": {
                "$ref": "#/components/schemas/deviceBillingStatusObject"
              },
              "notifyMediaAvailable": {
                "$ref": "#/components/schemas/notifyMediaAvailableObject"
              },
              "subscribeForAlarmUpdates": {
                "$ref": "#/components/schemas/subscribeForAlarmUpdatesObject"
              },
              "deviceRemoved": {
                "$ref": "#/components/schemas/deviceRemovedObject"
              },
              "auxiliaryCamerasConnectionStatus": {
                "$ref": "#/components/schemas/auxiliaryCamerasConnectionStatusObject"
              },
              "privacyMode": {
                "$ref": "#/components/schemas/privacyModeObject"
              },
              "dataUsage": {
                "$ref": "#/components/schemas/dataUsageObject"
              },
              "dynamicAdjust": {
                "$ref": "#/components/schemas/dynamicAdjustObject"
              }
            }
          }
        },
        "example": {
          "imei": "357660101000198",
          "url": "http://mywebhook.com",
          "type": "systemMessages",
          "config": {
            "dataProfile": {
              "isEnabled": false,
              "dataProfileLimit": 90
            },
            "deviceStatus": {
              "isEnabled": false
            },
            "deviceBillingStatus": {
              "isEnabled": false
            },
            "deviceRemoved": {
              "isEnabled": false
            },
            "auxiliaryCamerasConnectionStatus": {
              "isEnabled": false
            },
            "dataUsage": {
              "isEnabled": false,
              "dataPlan": 1
            },
            "dynamicAdjust": {
              "isEnabled": false
            }
          }
        }
      },
      "webhookTypeGps": {
        "type": "object",
        "title": "WebhookTypeGps",
        "description": "The webhook object.",
        "required": [
          "imei",
          "url",
          "type"
        ],
        "properties": {
          "imei": {
            "$ref": "#/components/schemas/imei"
          },
          "url": {
            "type": "string",
            "description": "The URL where the webhook is posted.",
            "example": "http://mywebhook.com"
          },
          "type": {
            "type": "string",
            "description": "The type of the webhook. For the event type, every event triggered for this device is posted using the webhook. For the GPS type, all GPS information is posted. For the alarms type, every alarm is posted. For the systemMessages type, every system message triggered for this device is posted using the webhook based on config settings.",
            "enum": [
              "gps"
            ]
          }
        },
        "example": {
          "imei": "357660101000198",
          "url": "http://mywebhook.com",
          "type": "gps"
        }
      },
      "webhookTypeEvent": {
        "type": "object",
        "title": "WebhookTypeEvent",
        "description": "The webhook object.",
        "required": [
          "imei",
          "url",
          "type"
        ],
        "properties": {
          "imei": {
            "$ref": "#/components/schemas/imei"
          },
          "url": {
            "type": "string",
            "description": "The URL where the webhook is posted.",
            "example": "http://mywebhook.com"
          },
          "type": {
            "type": "string",
            "description": "The type of the webhook. For the event type, every event triggered for this device is posted using the webhook. For the GPS type, all GPS information is posted. For the alarms type, every alarm is posted. For the systemMessages type, every system message triggered for this device is posted using the webhook based on config settings.",
            "enum": [
              "event"
            ]
          },
          "config": {
            "type": "object",
            "properties": {
              "notifyMediaAvailable": {
                "$ref": "#/components/schemas/notifyMediaAvailableObject"
              }
            }
          }
        },
        "example": {
          "imei": "357660101000198",
          "url": "http://mywebhook.com",
          "type": "event",
          "config": {
            "notifyMediaAvailable": {
              "isEnabled": false
            }
          }
        }
      },
      "webhookTypeAlarms": {
        "type": "object",
        "title": "WebhookTypeAlarms",
        "description": "The webhook object.",
        "required": [
          "imei",
          "url",
          "type"
        ],
        "properties": {
          "imei": {
            "$ref": "#/components/schemas/imei"
          },
          "url": {
            "type": "string",
            "description": "The URL where the webhook is posted.",
            "example": "http://mywebhook.com"
          },
          "type": {
            "type": "string",
            "description": "The type of the webhook. For the event type, every event triggered for this device is posted using the webhook. For the GPS type, all GPS information is posted. For the alarms type, every alarm is posted. For the systemMessages type, every system message triggered for this device is posted using the webhook based on config settings.",
            "enum": [
              "alarms"
            ]
          },
          "config": {
            "type": "object",
            "properties": {
              "subscribeForAlarmUpdates": {
                "$ref": "#/components/schemas/subscribeForAlarmUpdatesObject"
              }
            }
          }
        },
        "example": {
          "imei": "357660101000198",
          "url": "http://mywebhook.com",
          "type": "alarms",
          "config": {
            "subscribeForAlarmUpdates": {
              "isEnabled": false
            }
          }
        }
      },
      "webhookTypeSystemMessages": {
        "type": "object",
        "title": "WebhookTypeSystemMessages",
        "description": "The webhook object.",
        "required": [
          "imei",
          "url",
          "type"
        ],
        "properties": {
          "imei": {
            "$ref": "#/components/schemas/imei"
          },
          "url": {
            "type": "string",
            "description": "The URL where the webhook is posted.",
            "example": "http://mywebhook.com"
          },
          "type": {
            "type": "string",
            "description": "The type of the webhook. For the event type, every event triggered for this device is posted using the webhook. For the GPS type, all GPS information is posted. For the alarms type, every alarm is posted. For the systemMessages type, every system message triggered for this device is posted using the webhook based on config settings.",
            "enum": [
              "systemMessages"
            ]
          },
          "config": {
            "type": "object",
            "properties": {
              "dataProfile": {
                "$ref": "#/components/schemas/dataProfileObject"
              },
              "deviceStatus": {
                "$ref": "#/components/schemas/deviceStatusObject"
              },
              "deviceBillingStatus": {
                "$ref": "#/components/schemas/deviceBillingStatusObject"
              },
              "deviceRemoved": {
                "$ref": "#/components/schemas/deviceRemovedObject"
              },
              "auxiliaryCamerasConnectionStatus": {
                "$ref": "#/components/schemas/auxiliaryCamerasConnectionStatusObject"
              },
              "auxiliaryCamerasPairingStatus": {
                "$ref": "#/components/schemas/deviceAuxiliaryCamerasPairingStatusObject"
              },
              "privacyMode": {
                "$ref": "#/components/schemas/privacyModeObject"
              },
              "dataUsage": {
                "$ref": "#/components/schemas/dataUsageObject"
              },
              "dynamicAdjust": {
                "$ref": "#/components/schemas/dynamicAdjustObject"
              }
            }
          }
        },
        "example": {
          "imei": "357660101000198",
          "url": "http://mywebhook.com",
          "type": "systemMessages",
          "config": {
            "dataProfile": {
              "isEnabled": false,
              "dataProfileLimit": 90
            },
            "deviceStatus": {
              "isEnabled": false
            },
            "deviceBillingStatus": {
              "isEnabled": false
            },
            "deviceRemoved": {
              "isEnabled": false
            },
            "auxiliaryCamerasConnectionStatus": {
              "isEnabled": false
            },
            "privacyMode": {
              "isEnabled": false
            },
            "dataUsage": {
              "isEnabled": false,
              "dataPlan": 1
            },
            "dynamicAdjust": {
              "isEnabled": false
            }
          }
        }
      },
      "weeklyAggregateResult": {
        "title": "Weekly results",
        "description": "The overall result of the previous weeks for the entity.",
        "required": [
          "weeksAgo",
          "startTime",
          "endTime",
          "count"
        ],
        "properties": {
          "weeksAgo": {
            "description": "The number of previous weeks included in the statistical trends.",
            "type": "integer",
            "minimum": 0,
            "example": 2
          },
          "startTime": {
            "description": "The start time of the previous weeks, in ISO format.",
            "type": "string",
            "format": "date-time"
          },
          "endTime": {
            "description": "The end time of the previous weeks, in ISO format.",
            "type": "string",
            "format": "date-time"
          },
          "count": {
            "description": "The total number of results for the previous weeks.",
            "type": "integer",
            "minimum": 0,
            "example": 1
          }
        }
      },
      "rejectedImei": {
        "title": "Rejected IMEI",
        "description": "IMEI which has been rejected along with reason and error code",
        "type": "object",
        "required": [
          "imei",
          "name",
          "reason",
          "errorCode"
        ],
        "properties": {
          "imei": {
            "$ref": "#/components/schemas/imei"
          },
          "name": {
            "type": "string"
          },
          "reason": {
            "description": "Reason for rejecting this IMEI",
            "type": "string",
            "example": "group not found"
          },
          "errorCode": {
            "description": "Reject error codes: 1000 - group not found, 1001 - device already assigned, 1002 - device was not found by imei, 1003 - device locked, 1004 - failure in ai-14 authorization",
            "type": "integer",
            "example": 1000
          }
        }
      },
      "acceptedImei": {
        "title": "Accepted IMEI",
        "description": "IMEI which has been accepted along with serialNumber and edgeId",
        "type": "object",
        "required": [
          "serialNumber",
          "edgeId"
        ],
        "properties": {
          "serialNumber": {
            "description": "The camera serial number.",
            "type": "integer",
            "example": "357660101007029"
          },
          "edgeId": {
            "description": "The edge Id.",
            "type": "integer",
            "example": 1057395
          }
        }
      },
      "acceptedBillingImei": {
        "title": "Accepted IMEI",
        "description": "IMEI which has been accepted",
        "type": "string",
        "example": "357660101007029"
      },
      "rejectedBillingImei": {
        "title": "Rejected IMEI",
        "description": "IMEI which has been rejected along with reason and error code",
        "type": "object",
        "required": [
          "imei",
          "reason",
          "errorCode"
        ],
        "properties": {
          "imei": {
            "$ref": "#/components/schemas/imei"
          },
          "reason": {
            "description": "Reason for rejecting this IMEI",
            "type": "string",
            "example": "Not authorized"
          },
          "errorCode": {
            "description": "Reject error codes: 1000 - Not authorized, 1001 - IMEI was not found",
            "type": "integer",
            "example": 1000
          }
        }
      },
      "putBulkDeviceConfigOrganization": {
        "description": "The bulk device configuration by organization object.",
        "type": "object",
        "required": [
          "organizationId",
          "config"
        ],
        "properties": {
          "organizationId": {
            "$ref": "#/components/schemas/organizationId"
          },
          "groupIds": {
            "description": "The IDs of the requested groups. Obtain group IDs from GET /organizations/{orgId}/devices.",
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/groupId"
            }
          },
          "config": {
            "$ref": "#/components/schemas/deviceConfig"
          }
        }
      },
      "putBulkDeviceConfigImeis": {
        "description": "The bulk device configuration by IMEI numbers object.",
        "type": "object",
        "required": [
          "imeis",
          "config"
        ],
        "properties": {
          "imeis": {
            "description": "The IMEI numbers of the devices. The IMEI number can be found on a sticker on the device itself or on the back of the device box.",
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/imei"
            }
          },
          "config": {
            "$ref": "#/components/schemas/deviceConfig"
          }
        }
      },
      "putBulkEventConfigImeis": {
        "description": "The bulk event configuration by IMEI numbers object.",
        "type": "object",
        "required": [
          "imeis",
          "config"
        ],
        "properties": {
          "imeis": {
            "description": "The IMEI numbers. The IMEI number can be found on a sticker on the device itself or on the back of the device box.",
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/imei"
            }
          },
          "config": {
            "$ref": "#/components/schemas/eventConfig"
          }
        }
      },
      "putBulkEventConfigGroups": {
        "description": "The bulk event configuration by organization object.",
        "type": "object",
        "required": [
          "organizationId",
          "config"
        ],
        "properties": {
          "organizationId": {
            "$ref": "#/components/schemas/organizationId"
          },
          "groupIds": {
            "description": "The group IDs array.",
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/groupId"
            }
          },
          "excludeSerialNumbers": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "config": {
            "$ref": "#/components/schemas/eventConfig"
          }
        }
      },
      "putBulkEventNotificationRecipientsOrganization": {
        "description": "The update recipients for email notifications of an event in bulk by organization object.",
        "type": "object",
        "required": [
          "organizationId",
          "notificationRecipients"
        ],
        "properties": {
          "organizationId": {
            "$ref": "#/components/schemas/organizationId"
          },
          "groupIds": {
            "description": "The IDs of the requested groups. Obtain group IDs from GET /organizations/{orgId}/devices.",
            "type": "array",
            "minItems": 1,
            "items": {
              "$ref": "#/components/schemas/groupId"
            }
          },
          "notificationRecipients": {
            "type": "array",
            "description": "The recipient emails.",
            "items": {
              "$ref": "#/components/schemas/email"
            }
          }
        }
      },
      "putBulkEventNotificationRecipientsImeis": {
        "description": "The update recipients for email notifications of an event in bulk by IMEI numbers object.",
        "type": "object",
        "required": [
          "imeis",
          "notificationRecipients"
        ],
        "properties": {
          "imeis": {
            "description": "The IMEI numbers of the devices. The IMEI number can be found on a sticker on the device itself or on the back of the device box.",
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/imei"
            }
          },
          "notificationRecipients": {
            "type": "array",
            "description": "The recipient emails.",
            "items": {
              "$ref": "#/components/schemas/email"
            }
          }
        }
      },
      "commonRequestAdasFields": {
        "title": "Common ADAS Fields",
        "description": "Common fields used for ADAS calibration data.",
        "type": "object",
        "required": [
          "cameraHeight",
          "cameraOffset",
          "vehicleWidth"
        ],
        "properties": {
          "cameraHeight": {
            "description": "The height of the device from the ground, in cm.",
            "type": "integer",
            "minimum": 100,
            "maximum": 400,
            "example": 160
          },
          "cameraOffset": {
            "description": "The horizontal offset of the device from the center of the windshield, in cm. Positive for right, negative for left.",
            "type": "integer",
            "minimum": -200,
            "maximum": 200,
            "example": 5
          },
          "vehicleWidth": {
            "description": "The vehicle rear axle width, with tires out, in cm.",
            "type": "number",
            "minimum": 100,
            "maximum": 400,
            "example": 200
          }
        }
      },
      "privacyMode": {
        "type": "string",
        "enum": [
          "general",
          "disabled"
        ],
        "example": "disabled"
      },
      "rmaUpdatedAt": {
        "title": "RMA Device updated time",
        "description": "The date when the device is updated as RMA in ISO 8601 format.",
        "type": "string",
        "format": "date-time"
      },
      "rmaDevice": {
        "type": "object",
        "title": "RMA Device",
        "description": "The RMA device status object.",
        "required": [
          "imei"
        ],
        "properties": {
          "deviceName": {
            "$ref": "#/components/schemas/deviceName"
          },
          "imei": {
            "$ref": "#/components/schemas/imei"
          },
          "organizationName": {
            "$ref": "#/components/schemas/organizationName"
          },
          "rmaUpdatedAt": {
            "$ref": "#/components/schemas/rmaUpdatedAt"
          },
          "organizationId": {
            "$ref": "#/components/schemas/organizationId"
          }
        }
      }
    }
  }
}
Pagination
Pagination lowers the API response times, which increases performance of the application for large data sets.

If large amounts of data are being retrieved, your API call could time out after 30 seconds. To prevent this from occuring, we recommend using pagination in the query parameters of your API call.

The pagination parameters include the:

count - the total number of results retrieved
limit - the maximum number of results to retrieve
offset - the number of results to omit
You can set the limit and offset for certain API calls in the calls' query parameters. For calls that use pagination, the count, limit, and offset are returned in the response as metadata.

The following are API calls for which pagination can be used:

GET /devices/{imei}/events
GET /organizations/{orgId}/devices
POST /organizations/{orgId}/events
The following is an example of an API request with pagination:

    curl --request POST https://api-prod.surfsight.net/v2/organizations/{organizationId}/events
    --header 'Content-Type: application/json'
    --header 'Authorization: Bearer {token}'
    --data-raw '{
            "offset": 10
            "limit": 1
            "start": 2021-12-24T09:50:07.485Z
            "end": 2021-12-27T09:50:07.485Z
            "eventTypes": ["acceleration","button"]
    }'
The following is an example of an API response with pagination:

{ 
"data": [
    {
        "id": 3,
        "eventType": "acceleration",
        "time": "2020-01-01T14:48:00.000Z",
        "lat": 32.0598671,
        "lon": 34.7827316,
        "speed": 22.51,
        "accuracy": 4,
        "status": "new",
        "severity": 1,
        "eventComments": [
            {
                "id": 125,
                "comment": "string",
                "createdByAudienceName": "surfsight",
                "createdById": 625,
                "createdBy": {
                    "id": 32,
                    "email": "email@email.com"
                    },
                "createdAt": "2021-12-27T10:33:43Z"
            }
        ],
        "files": [
            {
                "cameraId": 1,
                "fileType": "video",
                "fileId": "1595077872"
            }
        ],
        "geoFenceId": 3,
        "metadata": "{type:'Test event', scope:'Some test scope'}"
    }
],
"metadata": {
    "count": 15,
    "limit": 1,
    "offset": 10
    }
}
Call structure
Your call to the Surfsight API should appear similar to:

curl --request {httpMethod} 'https://{baseUrl}/{apiVersion}/{apiEndpoint}?{queryString}'
--header 'Authorization: Bearer {token}'
Environments of the base URL:

North America: https://api-prod.surfsight.net/v2/
Europe: https://api.de.surfsight.net/v2/
Note
Authentication tokens only work for the environment to which you are registered. For example, a user registered to the US cloud receives tokens for that cloud, and not the EU cloud.

The API call includes the following components:

Code Style	Description	Example	Type
httpMethod	REST API HTTP standards	GET,PUT, POST, DELETE	method
baseUrl	Surfsight base URL	https://api-prod.surfsight.net	url
apiVersion	The version of the Surfsight API in the request	v2	url
apiEndpoint	API URL path	/devices/{imei}/events	url
queryString	Optional filters for API requests	gps?start=2021-10-22T01:00:00.000Z&end=2021-10-22T20:59:59.999Z	request line
token	JWT authentication token	23mRzvuTKPc...	header


Download event media
When an event is triggered, it can be uploaded in video format, as a snapshot, or with no media at all. You can configure these settings in the event settings API.

Important
All events are saved on the cloud for 31 days unless configured otherwise using /organizations request

These media files play audio unless otherwise configured to be OFF using the /devices/{imei}/device-config request.

The rest of this guide shows you how to use the Surfsight API, to quickly perform the following steps:

Authenticate yourself.
Get list of available events media files.
Download event media.
1. Authenticate yourself
Authenticate yourself before making any calls with the Surfsight API. For more details on authentication, see our authentication overview.

2. Get list of available events media files
Request the available events from the cloud using the GET /devices/{imei}/events with a query parameter relevant to the time range:

curl --request GET https://api-prod.surfsight.net/v2/devices/{imei}/events?start=2021-10-15T09:00:00.000Z&end=2021-10-20T20:59:59.999Z'
--header 'Content-Type: application/json'
--header 'Authorization: Bearer {token}'
The returned response:

        {
            "id": 190537212,
            "eventType": "sharpTurnRight",
            "lat": 32.48636437,
            "lon": 34.95381069,
            "speed": 49.319999313354494,
            "time": "2021-10-16T13:33:00.000Z",
            "files": [
                {
                    "cameraId": 1,
                    "fileId": "1634391180",
                    "fileType": "video"
                },
                {
                    "cameraId": 2,
                    "fileId": "1634391180",
                    "fileType": "video"
                }
            ]
        }
3. Download event media
Request links to download event media files stored on the cloud by using the GET https://api-prod.surfsight.net/v2/devices/{imei}/event-file-link API request.

The required query parameters, cameraId, fileId and fileType, must be entered as they were received by /devices/{imei}/events API response:

Component	Description	Required	Example
imei	The IMEI of the device. The IMEI number can be found on a sticker on the device itself or on the back of the device box.	Required	357660101000198
fileId	Time in UNIX of the event.	Required	1634391180
cameraId	The ID of the in-cab or road-facing lens, or any paired auxiliary camera. 1 - road-facing lens, 2 - in-cab lens, 50+ - auxiliary cameras. Use 0 for all cameras, or with the cameraIds parameter for a list of specific cameras.	Required	1
fileType	Media type of the event	Required	Video
cameraIds	A list of the camera IDs, separated by a comma. This may include the in-cab or road-facing lens, or any paired auxiliary camera: 1 - road-facing lens, 2 - in-cab lens, 50+ - auxiliary cameras. The list of cameras can be used only if cameraId=0 is provided.	Optional	1,2,51,52
conceal	Parameter to blur images. For more information, see Integrate the Conceal service	Optional	true
Request for one event media file:

curl --request GET https://api-prod.surfsight.net/v2/devices/{imei}/event-file-link?fileId=1634391180&cameraId=1&fileType=video
--header 'Content-Type: application/json'
--header 'Authorization: Bearer {token}'
Returned response:

{
    "data": {
        "url": "https://surfsight-organizations-production.s3.amazonaws.com/2a4837d8-5d88-43dd-94f4-894e81b476f4/{imei}/{imei}_1634391180_1.mp4?
        X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIAUAWC3GNZKY7KPK35%2F20211020%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20211020T064221Z&X
        -Amz-Expires=345600&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEEMaCXVzLWVhc3QtMiJHMEUCIQCgFlK1Uu4hH8NRf04jgJeF94RXr0J3nJNr3oRm0e6vdgIgOWu9O0kNXMsqmnYX
        %2FKGjRJD4tx........................
    },
    "requestId": "45778fc6-ad06-400e-af6b-0dbcd8546002"
}
Request for multiple event media files:

curl --request GET v2/devices/{{imei}}/event-file-link?fileId={{eventFileId}}&cameraId=0&fileType={{eventFileType}}&cameraIds=1,2,3,4,5
--header 'Content-Type: application/json'
--header 'Authorization: Bearer {token}'
Returned response:

{ 
  "data": {
    "url": "[{\'camera_id1\': \'www.somepath1.url\'},{\'camera_id2\': \'www.somepath2.url\'}]"
  }
}
Note
The link to the media file will expire after four days and a new request must be made in order to access the media file again.