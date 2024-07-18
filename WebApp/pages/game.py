from __init__ import *
from pages.nav import *
import datetime
from utils import *
from app import app

# Fetch player names from the database
player_names = get_players_names()
contract_names = ['Small', 'Guard', 'Guard without', 'Guard against']
# Create options for dbc.Select
player_options = [{'label': name, 'value': name} for name in player_names]
contract_options = [{'label': name, 'value': name} for name in contract_names]
main_game = html.Div(
    [
        navbar,  # add the navbar from nav.py

        html.Br(),  # Vertical space
        html.Br(),

        dbc.Card(
            [
                dbc.CardHeader(html.H2("Game menu", className="text-center mr-1",)),
                dbc.CardBody([
                    # Add scrolling menus for player selection
                    html.Hr(),
                    html.H5("Select Players:", className="card-title", style={"text-align": "center"}),
                    dbc.Row([
                        dbc.Col(dbc.Select(id='player-select-1', options=player_options, placeholder="Select Player 1"), width=2),
                        dbc.Col(dbc.Select(id='player-select-2', options=player_options, placeholder="Select Player 2"), width=2),
                        dbc.Col(dbc.Select(id='player-select-3', options=player_options, placeholder="Select Player 3"), width=2),
                        dbc.Col(dbc.Select(id='player-select-4', options=player_options, placeholder="Select Player 4"), width=2),
                        dbc.Col(dbc.Select(id='player-select-5', options=player_options, placeholder="Select Player 5"), width=2),
                    ], justify="around"),
                    html.Hr(),
                    html.Hr(),
                    dbc.Row([
                        dbc.Col([html.H5("Taker:", className="card-title", style={"text-align": "center"}),
                        dbc.Row([
                            dbc.Col(dbc.Select(id='taker', options=[], placeholder="Select Contract"), width=2),
                        ], justify="center"),
                        ]),
                        dbc.Col([html.H5("Contract:", className="card-title", style={"text-align": "center"}),
                        dbc.Row([
                            dbc.Col(dbc.Select(id='contract', options=contract_options, placeholder="Select Contract"), width=2),
                        ], justify="center"),
                        ]),
                        dbc.Col([
                            html.H5("Number of Oudlers:", className="card-title", style={"text-align": "center"}),
                            dbc.Row(
                                dbc.Col(
                                    dbc.Input(
                                        type="number",
                                        id="number-of-oudlers",
                                        min=0, max=3, step=1,
                                        placeholder="Enter number of Oudlers (0-3)",
                                    ),
                                width={"size": 10},  # Adjust width and offset to center the input field
                                ),
                                justify="center",
                            ),
                        ]),
                    ]),
                    html.Hr(),
                    dbc.Row([
                        dbc.Col([
                            html.H5("Additional Options:", className="card-title", style={"text-align": "center"}),
                            dbc.Row(
                                    dbc.Col(
                                        dbc.Checklist(
                                            options=[
                                                {"label": "Petit au bout", "value": "petit_au_bout"},
                                                {"label": "Misery", "value": "misery"},
                                                {"label": "Poignée", "value": "poignee"},
                                                {"label": "Double Poignée", "value": "2poignee"},
                                                {"label": "Triple Poignée", "value": "3poignee"},
                                            ],
                                            value=[],
                                            id="additional-options",
                                            inline=True,
                                        ),
                                        width={"size": 6, "offset": 1},  # Adjust the size and offset to center the checklist
                                    ),
                                    justify="center",
                            ),
                        ]),
                        dbc.Col([
                            html.H5("Score:", className="card-title", style={"text-align": "center"}),
                            dbc.Row(
                                dbc.Col(
                                    dbc.Input(
                                        type="number",
                                        id="number-of-points",
                                        placeholder="Enter number of points",
                                    ),
                                width={"size": 7},  # Adjust width and offset to center the input field
                                ),
                                justify="center",
                            ),
                        ]),
                    ]),
                    html.Hr(),
                    #Button to save game
                    dbc.Row(
                        dbc.Col(
                            dbc.Button("Save Game", color="primary", className="w-100", id = "save-game-button"),
                            width={"size": 4, "offset": 4},
                        ),
                        className="mt-3",  # Top margin
                    ),
                    
                ]),
            ],
        ),
        html.Div(id='page-game-content'),
    ],
    
)   

@app.callback(
    Output('taker', 'options'),
    [Input('player-select-1', 'value'),
     Input('player-select-2', 'value'),
     Input('player-select-3', 'value'),
     Input('player-select-4', 'value'),
     Input('player-select-5', 'value')]
)
def update_taker_options(*selected_players):
    selected_players = [player for player in selected_players if player is not None]
    taker_options = [{'label': option['label'], 'value': option['value']} for option in player_options if option['value'] in selected_players]
    return taker_options

#compute the number of points made
@app.callback(
    Output('page-game-content', 'children'),
    [Input('contract', 'value'),
     Input('number-of-oudlers', 'value'),
     Input('additional-options', 'value'),
     Input('number-of-points', 'value'),
     Input('save-game-button', 'n_clicks')]
)
def compute_points(contract, oudlers, additional_options, num, n_clicks):
    if n_clicks is not None:
        if contract is None or oudlers is None or num is None:
            alert = dbc.Alert("Please fill in all the fields", color="danger", style={"maxWidth": "500px"})
        else: 
            points = num
            coeff = 1
            point_to_make = 56
            # Add points for oudlers
            if oudlers == 0:
                point_to_make = 56
            elif oudlers == 1:
                point_to_make = 51
            elif oudlers == 2:
                point_to_make = 41
            elif oudlers == 3:
                point_to_make = 36
            # Compute the number of points made
            points = (points - point_to_make)*coeff
            # Compute the number of points based on the contract
            if contract == 'Small':
                coeff = 1
            elif contract == 'Guard':
                coeff = 2 
            elif contract == 'Guard without':
                coeff = 4
            elif contract == 'Guard against':
                coeff = 6
            points = (points - point_to_make)*coeff
            # Add points for additional options
            if 'petit_au_bout' in additional_options:
                points += 10
            if 'misery' in additional_options:
                points += 10
            if 'poignee' in additional_options:
                points += 10
            if '2poignee' in additional_options:
                points += 20
            if '3poignee' in additional_options:
                points += 30
            if points < 0:
                points = -points
                alert = dbc.Alert(f"Team has lost {points} points", color="danger", style={"maxWidth": "500px"})
            else:
                alert = dbc.Alert(f"Team has won {points} points", color="success", style={"maxWidth": "500px"})
        return dbc.Row(
            dbc.Col(
                alert,
                width={"size": 6, "offset":1},  # Adjust size and offset for centering
            ),
            justify="center",  # Ensure the column is centered in the row
        )
    else :
        return None
