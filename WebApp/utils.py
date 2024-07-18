from __init__ import *

def get_players_names():
    #returns the list of player names
    with open(os.path.join(database_path, 'players.csv'), 'r') as f:
        df = pd.read_csv(f)
        df['Full Name'] = df['Surname'] + ' ' + df['Name']
        return df['Full Name'].tolist()