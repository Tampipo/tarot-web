from __init__ import *
from pages.nav import *
import datetime

from app import app
from utils import get_players_names
from globals import player_options
main_acc = html.Div(
    [
    navbar,  # add the navbar from nav.py

    html.Br(),  # Vertical space
    html.Br(),

    dbc.Container(
        dbc.Card(
            [
                dbc.CardBody(
                    [
                        dbc.Row(
                            [
                                dbc.Col(
                                    dbc.CardGroup(
                                        [
                                            dbc.Label("Name", html_for="input-name",className="form-label text-center", style={"width": "100%"}),
                                            dbc.Input(type="text", id="input-name", placeholder="Enter your name",className="form-control-sm", style={"width": "30%", "margin": "auto", "display": "block"}),
                                        ]
                                    ),
                                    width={"size": 6, "offset": 3},  # Adjust size and offset for centering
                                ),
                            ],
                            className="mb-3",  # Margin bottom
                        ),
                        dbc.Row(
                            [
                                dbc.Col(
                                    dbc.CardGroup(
                                        [
                                            dbc.Label("Surname", html_for="input-surname", className="form-label text-center", style={"width": "100%"}),
                                            dbc.Input(type="text", id="input-surname", placeholder="Enter your surname",className="form-control-sm", style={"width": "30%", "margin": "auto", "display": "block"}),
                                        ]
                                    ),
                                    width={"size": 6, "offset": 3},  # Adjust size and offset for centering
                                ),
                            ],
                            className="mb-3",  # Margin bottom
                        ),
                        dbc.Row(
                            [
                                dbc.Col(
                                    dbc.CardGroup(
                                        [
                                            dbc.Label("Email", html_for="input-email", className="form-label text-center", style={"width": "100%"}),
                                            dbc.Input(type="email", id="input-email", placeholder="Enter your email",className="form-control-sm", style={"width": "30%", "margin": "auto", "display": "block"}),
                                        ]
                                    ),
                                    width={"size": 6, "offset": 3},  # Adjust size and offset for centering
                                ),
                            ],
                            className="mb-3",  # Margin bottom
                        ),
                        dbc.Row(
                            dbc.Col(
                                dbc.Button("Create Account", id="create-account-button", color="primary", className="w-100"),
                                width={"size": 4, "offset": 4},
                            ),
                            className="mt-3",  # Top margin
                        ),
                    ]
                ),
            ],
            body=True,
            className='mx-auto shadow p-3 mb-5 bg-body rounded',  # Centered, with shadow, padding, margin, and rounded corners
        ),
        fluid=True,  # Ensures the container is full width
        className="py-5",  # Vertical padding
    ),
    html.Div(id='page-mainabout-content'),
],
)


@app.callback(
    Output('page-mainabout-content', 'children'),
    [Input('create-account-button', 'n_clicks')],
    [State('input-name', 'value'),
     State('input-surname', 'value'),
     State('input-email', 'value')]
)
def create_account(n_clicks, name, surname, email):
    if n_clicks is not None:
        if name is None or surname is None or email is None:
            alert = dbc.Alert("Please fill in all fields.", color="danger", style={"maxWidth": "500px"})
        else:
            #check that account does not already exist
            #open player file in database
            with open(os.path.join(database_path, 'players.csv')) as f:
                df = pd.read_csv(f, dtype={'ID': int})
                #check if name surname combination exists
                player_exists = ((df['Name'] == name) & (df['Surname'] == surname)).any()
    
            if player_exists:
                # Player already exists, return an alert
                alert = dbc.Alert("An account with this name and surname already exists.", color="warning", style={"maxWidth": "500px"})
            else:
                # Player does not exist, proceed with account creation
                # Append new player data to the DataFrame
                
                if df['ID'].empty:
                    new_player = pd.DataFrame({'Name': [name], 'Surname': [surname], 'Email': [email], 'ID': [0]})
                else:
                    new_player = pd.DataFrame({'Name': [name], 'Surname': [surname], 'Email': [email], 'ID': [df['ID'].max() + 1]})
                df = pd.concat([df, new_player], ignore_index=True)
                
                # Save the updated DataFrame back to CSV
                df.to_csv(os.path.join(database_path, 'players.csv'), index=False)
                
                # Create account success alert
                alert = dbc.Alert(f"Account created for {name} {surname} with email {email}.", color="success", style={"maxWidth": "500px"})
                player_names = get_players_names()
                player_options[:] = [{'label': name, 'value': name} for name in player_names]
        return dbc.Row(
            dbc.Col(
                alert,
                width={"size": 6, "offset": 3},  # Adjust size and offset for centering
            ),
            justify="center",  # Ensure the column is centered in the row
        )
    else:
        return None