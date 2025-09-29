import os
import sys
import time
import threading
from uuid import uuid4

import boto3
from awscrt import auth, io, mqtt
from awscrt.exceptions import AwsCrtError
from awsiot import mqtt_connection_builder


refresh_token = os.getenv("REFRESH_TOKEN", "")
region = os.getenv("REGION", "ap-northeast-1")
user_pool_id = os.getenv("USER_POOL_ID", "ap-northeast-1_kRWuig6oV")
user_pool_client_id = os.getenv("USER_POOL_CLIENT_ID", "2jl8m0q968eudj7lubpdkuvq9v")
identity_pool_id = os.getenv("IDENTITY_POOL_ID", "ap-northeast-1:7e24baf3-0e4b-4c3a-bacf-ca1e9b7f4650")
endpoint = os.getenv("ENDPOINT", "ak6s01k4r928v-ats.iot.ap-northeast-1.amazonaws.com")
message_topic = os.getenv("MESSAGE_TOPIC", "object/lidar/vista-p90-3/person")
client_id = os.getenv("CLIENT_ID", "sample-" + str(uuid4()))


def fetch_id_token(refresh_token: str,
                   user_pool_client_id: str,
                   region: str = "ap-northeast-1") -> str:
    client = boto3.client("cognito-idp", region_name=region)
    response: dict = client.initiate_auth(
        AuthFlow='REFRESH_TOKEN_AUTH',
        AuthParameters={'REFRESH_TOKEN': refresh_token},
        ClientId=user_pool_client_id
    )
    return response['AuthenticationResult']['IdToken']


def fetch_identity_id(id_token: str,
                      user_pool_id: str,
                      identity_pool_id: str,
                      region: str = "ap-northeast-1") -> str:
    client = boto3.client("cognito-identity", region_name=region)
    response = client.get_id(
        IdentityPoolId=identity_pool_id,
        Logins={f"cognito-idp.{region}.amazonaws.com/{user_pool_id}": id_token}
    )
    return response['IdentityId']


def on_connection_interrupted(connection: mqtt.Connection,
                              error: AwsCrtError,
                              **kwargs) -> None:
    print(f"Connection interrupted. error: {error}")


def on_connection_resumed(connection: mqtt.Connection,
                          return_code: mqtt.ConnectReturnCode,
                          session_present: bool,
                          **kwargs) -> None:
    print("Connection resumed. "
          f"return_code: {return_code} session_present: {session_present}")


def on_message_received(topic: str,
                        payload: bytes,
                        dup: bool,
                        qos: mqtt.QoS,
                        retain: bool,
                        **kwargs) -> None:
    global _latest_object_count
    try:
        import json
        decoded_payload = json.loads(payload)
        count = len(decoded_payload.get("objects", []))
    except Exception:
        count = 0
    _latest_object_count = count


def connect_and_subscribe(identity_id: str | None) -> None:
    id_token = fetch_id_token(
        refresh_token=refresh_token,
        user_pool_client_id=user_pool_client_id,
        region=region,
    )

    if identity_id is None:
        identity_id = fetch_identity_id(
            id_token=id_token,
            user_pool_id=user_pool_id,
            identity_pool_id=identity_pool_id,
            region=region,
        )

    credentials_provider = auth.AwsCredentialsProvider.new_cognito(
        endpoint=f"cognito-identity.{region}.amazonaws.com",
        identity=identity_id,
        tls_ctx=io.ClientTlsContext(io.TlsContextOptions()),
        logins=[
            (f"cognito-idp.{region}.amazonaws.com/{user_pool_id}", id_token),
        ]
    )

    mqtt_connection = mqtt_connection_builder.websockets_with_default_aws_signing(
        endpoint=endpoint,
        client_id=client_id,
        region=region,
        credentials_provider=credentials_provider,
        on_connection_interrupted=on_connection_interrupted,
        on_connection_resumed=on_connection_resumed,
        clean_session=False,
        reconnect_min_timeout_secs=1,
        keep_alive_secs=30,
    )

    connect_future = mqtt_connection.connect()
    connect_future.result()
    print("Connected!")

    subscribe_future, _ = mqtt_connection.subscribe(
        topic=message_topic,
        qos=mqtt.QoS.AT_MOST_ONCE,
        callback=on_message_received,
    )
    subscribe_future.result()
    print("Subscribed!")

    try:
        while True:
            time.sleep(1)
    finally:
        disconnect_future = mqtt_connection.disconnect()
        disconnect_future.result()
        print("Disconnected!")


def subscriber_loop():
    identity_id = None
    backoff_time = 1
    while True:
        try:
            connect_and_subscribe(identity_id)
        except Exception as e:
            print(e, file=sys.stderr)
        time.sleep(backoff_time)
        backoff_time = min(backoff_time * 2, 600)


def start_subscriber():
    t = threading.Thread(target=subscriber_loop, daemon=True)
    t.start()


def get_latest_object_count() -> int:
    return int(_latest_object_count)


_latest_object_count = 0

